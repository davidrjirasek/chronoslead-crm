#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
montar_screencast.py - monta los screencasts de Meta App Review a partir de clips crudos.

Cada video sale como Meta lo pide: sin audio, un archivo por permiso y rotulos en ingles
quemados en una franja DEBAJO de la interfaz (1920x1080 de UI + 120 px de franja = 1920x1200),
H.264 a 30 fps. El rotulo nunca tapa la pantalla que el revisor necesita leer.

Subcomandos:
  inspeccionar CLIP [--cada 2] [--desde S] [--hasta S]  hojas de contacto con marcas de tiempo
  cuadro CLIP SEGUNDO                                   un cuadro 1920x1080 con cuadricula (coordenadas)
  montar EDL.json [--conservar]                         renderiza los videos descritos en el EDL
  revisar VIDEO.mp4 [--cada 4]                          QA: duracion, audio, resolucion y hoja de contacto

Requisitos: ffmpeg y ffprobe en el PATH, Python 3.9+ y Pillow (pip install pillow).
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Falta Pillow. Instala con:  pip install pillow")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

W, H, BANDA, FPS = 1920, 1080, 120, 30
FONDO = (10, 14, 28)
FONDO_HEX = "0x0a0e1c"
ACENTO_DEFECTO = "#0D5BFF"
ENC = ["-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS)]
NORMALIZAR = (f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,"
              f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={FONDO_HEX},setsar=1")

FUENTES = {
    True: [
        "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    False: [
        "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
}


# ---------------------------------------------------------------- utilidades

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise SystemExit(f"ffmpeg fallo:\n  {' '.join(map(str, cmd))}\n{r.stderr[-2500:]}")
    return r


def comprobar_herramientas():
    for exe in ("ffmpeg", "ffprobe"):
        if not shutil.which(exe):
            sys.exit(f"No encuentro {exe} en el PATH. Instala ffmpeg (incluye ffprobe) y vuelve a intentar.")


def fuente(tam, negrita=True):
    propia = os.environ.get("SCREENCAST_FUENTE_NEGRITA" if negrita else "SCREENCAST_FUENTE")
    for ruta in ([propia] if propia else []) + FUENTES[negrita]:
        if ruta and os.path.exists(ruta):
            return ImageFont.truetype(ruta, tam)
    try:
        return ImageFont.load_default(size=tam)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def color(hexa):
    hexa = hexa.lstrip("#")
    return tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4))


def aclarar(rgb, cuanto=0.45):
    return tuple(int(c + (255 - c) * cuanto) for c in rgb)


def partir(texto, f, ancho):
    lineas, actual = [], ""
    for palabra in texto.split():
        prueba = f"{actual} {palabra}".strip()
        if not actual or f.getlength(prueba) <= ancho:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas


def par(n):
    return int(n) - int(n) % 2


def probar(ruta):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                        "-of", "json", str(ruta)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise SystemExit(f"ffprobe no pudo leer {ruta}: {r.stderr.strip()}")
    info = json.loads(r.stdout)
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
    return float(info["format"]["duration"]), video, audio


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def extraer_cuadro(clip, t, ruta, ancho=None):
    vf = NORMALIZAR + (f",scale={ancho}:-2" if ancho else "")
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(t, 0):.3f}", "-i", str(clip), "-frames:v", "1",
         "-vf", vf, str(ruta)])


def hoja(imagenes, etiquetas, salida, columnas=5):
    miniaturas = [Image.open(p).convert("RGB") for p in imagenes]
    tw, th = miniaturas[0].size
    filas = (len(miniaturas) + columnas - 1) // columnas
    lienzo = Image.new("RGB", (columnas * tw, filas * (th + 34)), (0, 0, 0))
    d = ImageDraw.Draw(lienzo)
    f = fuente(24)
    for i, (im, et) in enumerate(zip(miniaturas, etiquetas)):
        x, y = (i % columnas) * tw, (i // columnas) * (th + 34)
        lienzo.paste(im, (x, y))
        d.text((x + 8, y + th + 4), et, font=f, fill=(255, 220, 90))
    lienzo.save(salida, quality=88)


# ---------------------------------------------------------------- graficos

def png_rotulo(texto, ruta, acento):
    im = Image.new("RGBA", (W, H + BANDA), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, H, W, H + BANDA], fill=FONDO + (255,))
    d.rectangle([0, H, W, H + 5], fill=acento + (255,))
    for tam in (38, 34, 30, 27):
        f = fuente(tam)
        lineas = partir(texto, f, W - 120)
        if len(lineas) <= 2:
            break
    else:
        raise SystemExit(f"Rotulo demasiado largo (no cabe en 2 lineas): {texto!r}. Acortalo.")
    alto = tam + 12
    y = H + 5 + (BANDA - 5 - alto * len(lineas)) // 2
    for i, linea in enumerate(lineas):
        d.text((60, y + alto * i), linea, font=f, fill="white")
    im.save(ruta)


def png_tarjeta(marca, titulo, subtitulo, ruta, acento):
    im = Image.new("RGB", (W, H + BANDA), FONDO)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=acento)
    d.text((120, 380), marca, font=fuente(44), fill=aclarar(acento))
    for tam in (76, 64, 54):
        ft = fuente(tam)
        if ft.getlength(titulo) <= W - 240:
            break
    d.text((120, 450), titulo, font=ft, fill="white")
    fs = fuente(40, negrita=False)
    for i, linea in enumerate(partir(subtitulo, fs, W - 240)[:4]):
        d.text((120, 580 + 56 * i), linea, font=fs, fill=(210, 215, 230))
    im.save(ruta)


# ---------------------------------------------------------------- EDL

def cargar_edl(ruta_edl):
    base = Path(ruta_edl).resolve().parent
    with open(ruta_edl, encoding="utf-8") as f:
        edl = json.load(f)
    videos = edl.get("videos") or [{"salida": edl.get("salida"), "segmentos": edl.get("segmentos", [])}]
    bloques = edl.get("bloques", {})
    marca = edl.get("marca", "")
    acento = color(edl.get("color_acento", ACENTO_DEFECTO))
    errores, duraciones = [], {}

    def expandir(segmentos):
        salida = []
        for s in segmentos:
            if "bloque" in s:
                if s["bloque"] not in bloques:
                    errores.append(f"Bloque inexistente: {s['bloque']}")
                    continue
                salida.extend(expandir(bloques[s["bloque"]]))
            else:
                salida.append(s)
        return salida

    for v in videos:
        if not v.get("salida"):
            errores.append("Cada video necesita 'salida' (ruta del .mp4 final).")
        v["segmentos"] = expandir(v.get("segmentos", []))
        for s in v["segmentos"]:
            etiqueta = s.get("id") or s.get("tarjeta") or "?"
            if "tarjeta" in s:
                continue
            for campo in ("clip", "desde", "hasta", "rotulo"):
                if campo not in s:
                    errores.append(f"[{etiqueta}] falta '{campo}'.")
            if "clip" not in s:
                continue
            clip = Path(s["clip"]) if Path(s["clip"]).is_absolute() else base / s["clip"]
            s["_clip"] = clip
            if not clip.exists():
                errores.append(f"[{etiqueta}] no existe el clip {clip}")
                continue
            if clip not in duraciones:
                duraciones[clip] = probar(clip)[0]
            a, b = float(s.get("desde", 0)), float(s.get("hasta", 0))
            if not 0 <= a < b <= duraciones[clip] + 0.05:
                errores.append(f"[{etiqueta}] tiempos fuera de rango: {a}-{b} (el clip dura {duraciones[clip]:.1f} s)")
            if float(s.get("velocidad", 1.0)) <= 0:
                errores.append(f"[{etiqueta}] 'velocidad' debe ser > 0")
            for caja in s.get("difuminar", []) + ([s["zoom"]] if "zoom" in s else []):
                x, y, w, h = (list(caja) + [0, 0, 0, 0])[:4]
                if len(caja) != 4 or w < 8 or h < 8 or x < 0 or y < 0 or x + w > W or y + h > H:
                    errores.append(f"[{etiqueta}] caja invalida {caja}: [x, y, ancho, alto] dentro de {W}x{H}")
    if errores:
        raise SystemExit("El EDL tiene errores:\n  - " + "\n  - ".join(errores))
    for v in videos:
        v["salida"] = Path(v["salida"]) if Path(v["salida"]).is_absolute() else base / v["salida"]
    return videos, marca, acento


def filtro_segmento(s):
    fc, cur = f"[0:v]{NORMALIZAR}[v0];", "v0"
    for i, caja in enumerate(s.get("difuminar", [])):
        x, y, w, h = (par(n) for n in caja)
        rl = max(1, min(30, min(w, h) // 2 - 1))
        rc = max(1, min(rl, min(w, h) // 4 - 1))
        fc += (f"[{cur}]split[d{i}a][d{i}b];[d{i}b]crop={w}:{h}:{x}:{y},"
               f"boxblur=luma_radius={rl}:luma_power=6:chroma_radius={rc}:chroma_power=6[d{i}c];"
               f"[d{i}a][d{i}c]overlay={x}:{y}[d{i}];")
        cur = f"d{i}"
    if "zoom" in s:
        x, y, w, h = (par(n) for n in s["zoom"])
        fc += (f"[{cur}]crop={w}:{h}:{x}:{y},scale={W}:{H}:force_original_aspect_ratio=decrease,"
               f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={FONDO_HEX},setsar=1[z];")
        cur = "z"
    vel = float(s.get("velocidad", 1.0))
    if vel != 1.0:
        fc += f"[{cur}]setpts=PTS/{vel},fps={FPS}[s];"
        cur = "s"
    fc += f"[{cur}]pad={W}:{H + BANDA}:0:0:color={FONDO_HEX}[p];[p][1:v]overlay=0:0[out]"
    return fc


def montar(ruta_edl, conservar=False):
    comprobar_herramientas()
    videos, marca, acento = cargar_edl(ruta_edl)
    for v in videos:
        salida = v["salida"]
        salida.parent.mkdir(parents=True, exist_ok=True)
        tmp = salida.parent / f".tmp_{salida.stem}"
        tmp.mkdir(exist_ok=True)
        estimado = sum(float(s.get("segundos", 3)) if "tarjeta" in s else
                       (float(s["hasta"]) - float(s["desde"])) / float(s.get("velocidad", 1.0))
                       for s in v["segmentos"])
        print(f"\n== {salida.name}: {len(v['segmentos'])} segmentos, ~{estimado:.1f} s")
        partes = []
        for n, s in enumerate(v["segmentos"], 1):
            nombre = f"{n:02d}-{s.get('id', 'tarjeta' if 'tarjeta' in s else 'seg')}"
            png, mp4 = tmp / f"{nombre}.png", tmp / f"{nombre}.mp4"
            if "tarjeta" in s:
                png_tarjeta(marca, s["tarjeta"], s.get("subtitulo", ""), png, acento)
                run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(png),
                     "-t", str(float(s.get("segundos", 3))), "-vf", f"fps={FPS},format=yuv420p", *ENC, str(mp4)])
            else:
                png_rotulo(s["rotulo"], png, acento)
                a, b = float(s["desde"]), float(s["hasta"])
                run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(s["_clip"]),
                     "-i", str(png), "-filter_complex", filtro_segmento(s), "-map", "[out]", *ENC, str(mp4)])
            partes.append(mp4)
            print(f"  ok {nombre}")
        lista = tmp / "lista.txt"
        lista.write_text("".join("file '{}'\n".format(p.resolve().as_posix().replace("'", "'\\''"))
                                 for p in partes), encoding="utf-8")
        run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista), *ENC,
             "-movflags", "+faststart", str(salida)])
        duracion, video, audio = probar(salida)
        huella = sha256(salida)
        print(f"  => {salida} | {duracion:.1f} s | {video['width']}x{video['height']} | "
              f"audio: {'SI (revisar)' if audio else 'no'} | sha256 {huella[:16]}...")
        if not 45 <= duracion <= 130:
            print("  AVISO: los videos aprobados que conocemos duran entre ~60 y ~120 s. Revisa el ritmo.")
        with open(salida.parent / "LEEME-entrega.txt", "a", encoding="utf-8") as f:
            f.write(f"{salida.name}\t{duracion:.1f} s\t{video['width']}x{video['height']}\tsin audio\tsha256 {huella}\n")
        if not conservar:
            shutil.rmtree(tmp, ignore_errors=True)
    print("\nListo. Corre 'revisar' sobre cada video antes de subirlo a Meta.")


# ---------------------------------------------------------------- inspeccion y QA

def inspeccionar(clip, cada=2.0, desde=0.0, hasta=None):
    comprobar_herramientas()
    clip = Path(clip)
    duracion = probar(clip)[0]
    hasta = min(hasta or duracion, duracion)
    carpeta = clip.parent / f"hojas_{clip.stem}"
    carpeta.mkdir(exist_ok=True)
    tiempos, t = [], desde
    while t < hasta:
        tiempos.append(round(t, 2))
        t += cada
    hojas = []
    for n in range(0, len(tiempos), 30):
        grupo = tiempos[n:n + 30]
        cuadros = []
        for t in grupo:
            p = carpeta / f"t{t:08.2f}.jpg"
            extraer_cuadro(clip, t, p, ancho=384)
            cuadros.append(p)
        salida = carpeta / f"hoja-{len(hojas) + 1:02d}.jpg"
        hoja(cuadros, [f"{t:.1f}s" for t in grupo], salida)
        for p in cuadros:
            p.unlink(missing_ok=True)
        hojas.append(salida)
    print(f"{clip.name}: {duracion:.1f} s. Hojas de contacto (cada {cada} s):")
    for h in hojas:
        print(f"  {h}")


def cuadro(clip, t):
    comprobar_herramientas()
    clip = Path(clip)
    salida = clip.parent / f"{clip.stem}-t{float(t):.1f}.png"
    extraer_cuadro(clip, float(t), salida)
    im = Image.open(salida).convert("RGB")
    d = ImageDraw.Draw(im)
    f = fuente(20)
    for x in range(0, W, 100):
        d.line([(x, 0), (x, H)], fill=(255, 0, 0) if x % 500 == 0 else (255, 150, 150), width=1)
        d.text((x + 3, 3), str(x), font=f, fill=(255, 0, 0))
    for y in range(0, H, 100):
        d.line([(0, y), (W, y)], fill=(255, 0, 0) if y % 500 == 0 else (255, 150, 150), width=1)
        d.text((3, y + 3), str(y), font=f, fill=(255, 0, 0))
    im.save(salida)
    print(f"Cuadro {W}x{H} con cuadricula de 100 px: {salida}")
    print("Las cajas de 'difuminar' y 'zoom' usan estas coordenadas: [x, y, ancho, alto].")


def revisar(video, cada=4.0):
    comprobar_herramientas()
    video = Path(video)
    duracion, v, audio = probar(video)
    print(f"{video.name}")
    print(f"  duracion   : {duracion:.1f} s {'(OK)' if 45 <= duracion <= 130 else '(revisa: lo usual es 60-120 s)'}")
    print(f"  resolucion : {v['width']}x{v['height']} {'(OK)' if v['height'] >= 1080 else '(Meta pide 1080p o mas)'}")
    print(f"  audio      : {'HAY PISTA DE AUDIO - quitala (Meta no escucha el audio)' if audio else 'sin audio (OK)'}")
    carpeta = video.parent / f".qa_{video.stem}"
    carpeta.mkdir(exist_ok=True)
    tiempos, t = [], 0.5
    while t < duracion:
        tiempos.append(round(t, 2))
        t += cada
    cuadros = []
    for t in tiempos:
        p = carpeta / f"t{t:08.2f}.jpg"
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1",
             "-vf", "scale=480:-2", str(p)])
        cuadros.append(p)
    salida = video.parent / f"{video.stem}.hoja.jpg"
    hoja(cuadros, [f"{t:.1f}s" for t in tiempos], salida, columnas=4)
    shutil.rmtree(carpeta, ignore_errors=True)
    print(f"  hoja       : {salida}")
    print("  Revisa en la hoja: rotulos legibles y en ingles, nada de tokens/PIN/contrasenas/"
          "telefonos de terceros, y el orden igual al texto del permiso.")


def main():
    p = argparse.ArgumentParser(description="Monta screencasts de Meta App Review (sin audio, rotulos en ingles).")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("inspeccionar", help="hojas de contacto con marcas de tiempo de un clip crudo")
    a.add_argument("clip")
    a.add_argument("--cada", type=float, default=2.0)
    a.add_argument("--desde", type=float, default=0.0)
    a.add_argument("--hasta", type=float)
    c = sub.add_parser("cuadro", help="un cuadro 1920x1080 con cuadricula para elegir coordenadas")
    c.add_argument("clip")
    c.add_argument("segundo", type=float)
    m = sub.add_parser("montar", help="renderiza los videos del EDL")
    m.add_argument("edl")
    m.add_argument("--conservar", action="store_true", help="no borra los segmentos intermedios")
    r = sub.add_parser("revisar", help="QA del video final")
    r.add_argument("video")
    r.add_argument("--cada", type=float, default=4.0)
    args = p.parse_args()
    if args.cmd == "inspeccionar":
        inspeccionar(args.clip, args.cada, args.desde, args.hasta)
    elif args.cmd == "cuadro":
        cuadro(args.clip, args.segundo)
    elif args.cmd == "montar":
        montar(args.edl, args.conservar)
    else:
        revisar(args.video, args.cada)


if __name__ == "__main__":
    main()
