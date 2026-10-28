"use client";

import Image from "next/image";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { guardarSeccionAction } from "@/app/(cuestionario)/actions";
import { ESTADO_INICIAL } from "@/server/cuestionario/estado";
import {
  MINUTOS_TOTALES,
  SECCIONES,
  TOTAL_SECCIONES,
  type Bloque,
  type Campo,
  minutosRestantes,
} from "@/server/cuestionario/secciones";

/**
 * 127 — El cuestionario de puesta en marcha, por pasos.
 *
 * Tres cosas que el dueño pidió explícitamente y que mandan sobre el diseño:
 *
 * 1. **Una sección por pantalla**, nunca las diez juntas. Un formulario largo
 *    de una sola pantalla se abandona al ver la barra de scroll.
 * 2. **El avance a la vista desde el primer momento**: en qué sección está, de
 *    cuántas, y cuántos minutos faltan. El pedido textual fue que el cliente
 *    no quede «con la incertidumbre de cuándo termina».
 * 3. **Que pueda cortar y volver.** Se guarda en el servidor al pasar de
 *    sección, y además un borrador local por si cierra la pestaña a media
 *    sección.
 *
 * Usa los tokens del sistema de diseño (`primary` es el naranja de
 * ChronosLead) y la cabecera de marca que ya existía para las páginas
 * públicas: no se redibuja lo que el repo ya tiene.
 */

type Inicial = {
  llave: string;
  cliente: string;
  contacto: string | null;
  correo: string | null;
  seccionActual: number;
  respuestas: Record<string, unknown>;
  enviado: boolean;
};

/** -1 es la portada; 0..9 las secciones; TOTAL_SECCIONES, la despedida. */
const PORTADA = -1;

export function Formulario({ inicial }: { inicial: Inicial | null }) {
  const [estado, enviar, pendiente] = useActionState(guardarSeccionAction, ESTADO_INICIAL);

  const [llave, setLlave] = useState(inicial?.llave ?? "");
  const [paso, setPaso] = useState(
    inicial ? (inicial.enviado ? TOTAL_SECCIONES : inicial.seccionActual) : PORTADA
  );
  const [identidad, setIdentidad] = useState({
    cliente: inicial?.cliente ?? "",
    contacto: inicial?.contacto ?? "",
    correo: inicial?.correo ?? "",
  });
  const [valores, setValores] = useState<Record<string, unknown>>(
    inicial?.respuestas ?? {}
  );

  const claveBorrador = `cuestionario:${llave || "nuevo"}`;

  // El borrador local es comodía, no la verdad: cubre cerrar la pestaña a
  // media sección, antes de que el servidor haya visto nada.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(claveBorrador);
      if (!crudo) return;
      const guardado: unknown = JSON.parse(crudo);
      if (guardado && typeof guardado === "object" && !Array.isArray(guardado)) {
        setValores((v) => ({ ...(guardado as Record<string, unknown>), ...v }));
      }
    } catch {
      /* Un borrador ilegible no debe impedir llenar el formulario. */
    }
  }, [claveBorrador]);

  useEffect(() => {
    try {
      localStorage.setItem(claveBorrador, JSON.stringify(valores));
    } catch {
      /* Sin espacio o en privado: se sigue pudiendo completar. */
    }
  }, [claveBorrador, valores]);

  /**
   * Al volver de un guardado correcto: se fija la llave y se avanza UNA vez.
   *
   * El centinela no es decorativo. Sin él, el primer guardado avanzaba DOS
   * secciones: llega la llave nueva → `setLlave` → cambia una dependencia del
   * efecto → el efecto corre otra vez con el mismo `estado.ok` → segundo
   * `setPaso`. El cliente guardaba la sección 1 y aparecía en la 3, con la 2
   * salteada y sin ninguna señal de que eso había pasado.
   */
  const ultimoAtendido = useRef<unknown>(null);
  useEffect(() => {
    if (!estado.ok) return;
    if (ultimoAtendido.current === estado) return;
    ultimoAtendido.current = estado;
    if (estado.llave) setLlave(estado.llave);
    setPaso((p) => Math.min(p + 1, TOTAL_SECCIONES));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [estado]);

  const fijar = useCallback((id: string, valor: unknown) => {
    setValores((v) => ({ ...v, [id]: valor }));
  }, []);

  /**
   * El origen se lee DESPUÉS de montar, no durante el render.
   *
   * Leyendo `window.location.origin` en el render, el servidor dibujaba sin
   * el enlace y el navegador con él: desajuste de hidratación, que React
   * resuelve rehaciendo el árbol entero. Funcionaba a la vista y rompía la
   * hidratación de toda la página.
   */
  const [origen, setOrigen] = useState("");
  useEffect(() => setOrigen(window.location.origin), []);

  const enlaceParaContinuar = useMemo(
    () => (llave && origen ? `${origen}/?k=${llave}` : ""),
    [llave, origen]
  );

  if (paso === TOTAL_SECCIONES) {
    return (
      <Marco>
        <Cerrada enlace={enlaceParaContinuar} />
      </Marco>
    );
  }

  if (paso === PORTADA) {
    return (
      <Marco>
        <Portada
          identidad={identidad}
          setIdentidad={setIdentidad}
          onEmpezar={() => setPaso(0)}
        />
      </Marco>
    );
  }

  const seccion = SECCIONES[paso];
  if (!seccion) return null;
  const ultima = paso === TOTAL_SECCIONES - 1;

  return (
    <Marco>
      <Avance paso={paso} />

      <form action={enviar} className="mt-8">
        <input type="hidden" name="llave" value={llave} />
        <input type="hidden" name="seccion" value={paso} />
        <input type="hidden" name="cliente" value={identidad.cliente} />
        <input type="hidden" name="contacto" value={identidad.contacto} />
        <input type="hidden" name="correo" value={identidad.correo} />
        <input type="hidden" name="final" value={ultima ? "1" : "0"} />
        <input
          type="hidden"
          name="datos"
          value={JSON.stringify(soloDeEstaSeccion(seccion.bloques, valores))}
        />

        <header className="space-y-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-primary">
            Sección {seccion.numero}
          </p>
          <h1 className="text-balance font-bold text-2xl text-foreground tracking-tight md:text-3xl">
            {seccion.titulo}
          </h1>
          {seccion.entrada ? (
            <p className="max-w-prose text-[15px] text-muted-foreground leading-relaxed">
              {seccion.entrada}
            </p>
          ) : null}
          {seccion.paraQuien ? (
            <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-[12.5px] font-medium text-secondary-foreground">
              {seccion.paraQuien}
            </p>
          ) : null}
        </header>

        <div className="mt-8 space-y-8">
          {seccion.bloques.map((b, i) =>
            b.tipo === "nota" ? (
              <Nota key={`nota-${paso}-${i}`} texto={b.texto} />
            ) : (
              <CampoVista
                key={b.id}
                campo={b}
                valor={valores[b.id]}
                falta={estado.faltan.includes(b.id)}
                onCambio={fijar}
              />
            )
          )}
        </div>

        {estado.error ? (
          <p
            role="alert"
            className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13.5px] text-foreground"
          >
            {estado.error}
          </p>
        ) : null}
        {/* «sigue acá» y no «está guardado»: cuando falta un obligatorio la
            acción corta ANTES de escribir, así que lo demás vive en la
            pantalla y en el borrador local, no en el servidor. */}
        {estado.faltan.length > 0 ? (
          <p
            role="alert"
            className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13.5px] text-foreground"
          >
            Falta una respuesta más arriba, marcada en rojo. Lo demás que escribiste sigue
            acá: no se perdió nada.
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center gap-3 border-t pt-6">
          {paso > 0 ? (
            <button
              type="button"
              onClick={() => setPaso(paso - 1)}
              className="h-11 rounded-xl border border-border-strong px-5 text-[14px] font-semibold text-foreground transition hover:bg-subtle"
            >
              Atrás
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pendiente}
            className="h-11 rounded-xl bg-primary px-6 text-[14px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : ultima ? "Terminar y enviar" : "Guardar y continuar"}
          </button>
          <p className="text-[12.5px] text-muted-foreground">
            Se guarda al continuar. Podés cerrar y volver después.
          </p>
        </div>
      </form>

      {enlaceParaContinuar ? <EnlaceParaContinuar enlace={enlaceParaContinuar} /> : null}
    </Marco>
  );
}

/* ---------- Estructura ---------- */

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background pb-20">
      <Image
        src="/legal/header-legal.png"
        alt="ChronosLead — Powered by Creativo 4D Group"
        width={2172}
        height={430}
        priority
        className="w-full"
      />
      <div className="mx-auto max-w-2xl px-6 pt-10">{children}</div>
    </main>
  );
}

/**
 * El avance. Es un requisito, no un adorno: el cliente tiene que poder
 * contestar «cuánto me falta» de un vistazo, en todo momento.
 */
function Avance({ paso }: { paso: number }) {
  const hechas = paso;
  const porcentaje = Math.round((hechas / TOTAL_SECCIONES) * 100);
  const minutos = minutosRestantes(paso);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] font-semibold text-foreground">
          Sección {paso + 1} de {TOTAL_SECCIONES}
        </p>
        <p className="font-mono text-[12.5px] text-muted-foreground tabular-nums">
          {minutos} min restantes
        </p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance del cuestionario"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

function Portada({
  identidad,
  setIdentidad,
  onEmpezar,
}: {
  identidad: { cliente: string; contacto: string; correo: string };
  setIdentidad: (v: { cliente: string; contacto: string; correo: string }) => void;
  onEmpezar: () => void;
}) {
  const listo = identidad.cliente.trim().length >= 2;
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-primary">
          Puesta en marcha
        </p>
        <h1 className="text-balance font-bold text-3xl text-foreground tracking-tight md:text-4xl">
          Para poner en marcha tu sistema 4D con IA
        </h1>
        <p className="max-w-prose text-[15.5px] text-muted-foreground leading-relaxed">
          Un solo lugar para las conversaciones, los contactos y las ventas de tu negocio, con un
          agente de IA que atiende por WhatsApp, Instagram y Facebook. Con esto lo configuramos a
          tu medida.
        </p>
      </header>

      {/* Lo que el dueño pidió que se sepa ANTES de empezar a escribir. */}
      <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
        {[
          ["Secciones", String(TOTAL_SECCIONES)],
          ["Tiempo estimado", `${MINUTOS_TOTALES} min`],
          ["Si lo cortan", "Sigue donde quedaron"],
        ].map(([t, v]) => (
          <div key={t} className="bg-background px-5 py-4">
            <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t}
            </dt>
            <dd className="mt-1 font-bold text-[15px] text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <Nota texto="Si algo no aplica, escriban «no aplica» — también es una respuesta útil. Y lo más valioso del cuestionario es la sección 5: lo que más les preguntan y cómo lo contestan hoy. De ahí sale casi toda la calidad del asistente." />

      <div className="space-y-5 rounded-2xl border bg-subtle p-6">
        <Texto
          etiqueta="¿De qué empresa o institución es este cuestionario?"
          requerido
          valor={identidad.cliente}
          onCambio={(v) => setIdentidad({ ...identidad, cliente: v })}
        />
        <Texto
          etiqueta="¿Quién lo está completando?"
          valor={identidad.contacto}
          onCambio={(v) => setIdentidad({ ...identidad, contacto: v })}
        />
        <Texto
          etiqueta="Correo de contacto"
          ayuda="Para poder volver a preguntarles si algo queda a medias."
          valor={identidad.correo}
          onCambio={(v) => setIdentidad({ ...identidad, correo: v })}
        />
      </div>

      <button
        type="button"
        onClick={onEmpezar}
        disabled={!listo}
        className="h-12 w-full rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
      >
        Empezar
      </button>
    </div>
  );
}

function Cerrada({ enlace }: { enlace: string }) {
  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-primary">
        Recibido
      </p>
      <h1 className="font-bold text-3xl text-foreground tracking-tight">Listo. Ya lo tenemos.</h1>
      <div className="space-y-3 text-[15px] text-muted-foreground leading-relaxed">
        <p>Lo que sigue, de nuestro lado:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Cargamos todo y configuramos el asistente</li>
          <li>Lo probamos contra conversaciones simuladas, antes de que hable con nadie real</li>
          <li>Se lo mostramos y lo ajustamos con ustedes</li>
          <li>Recién ahí lo encendemos</li>
        </ol>
        <p className="font-medium text-foreground">
          Nada sale al aire sin que ustedes lo hayan visto funcionando.
        </p>
      </div>
      {enlace ? (
        <p className="rounded-xl border bg-subtle px-4 py-3 text-[13px] text-muted-foreground">
          Si quieren corregir o agregar algo, el enlace sigue sirviendo:{" "}
          <span className="break-all font-mono text-foreground">{enlace}</span>
        </p>
      ) : null}
    </div>
  );
}

function EnlaceParaContinuar({ enlace }: { enlace: string }) {
  return (
    <p className="mt-10 rounded-xl border bg-subtle px-4 py-3 text-[12.5px] text-muted-foreground">
      <span className="font-semibold text-foreground">Para continuar en otro momento</span> o desde
      otro dispositivo, guarden este enlace:{" "}
      <span className="break-all font-mono text-foreground">{enlace}</span>
    </p>
  );
}

function Nota({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border-l-2 border-primary bg-subtle px-5 py-4 text-[14px] text-muted-foreground leading-relaxed">
      {texto}
    </p>
  );
}

/* ---------- Campos ---------- */

function CampoVista({
  campo,
  valor,
  falta,
  onCambio,
}: {
  campo: Campo;
  valor: unknown;
  falta: boolean;
  onCambio: (id: string, v: unknown) => void;
}) {
  const requerido = "requerido" in campo ? Boolean(campo.requerido) : false;
  const comun = { etiqueta: campo.etiqueta, ayuda: campo.ayuda, requerido, falta };

  if (campo.tipo === "texto") {
    return (
      <Texto
        {...comun}
        marcador={campo.marcador}
        valor={typeof valor === "string" ? valor : ""}
        onCambio={(v) => onCambio(campo.id, v)}
      />
    );
  }
  if (campo.tipo === "parrafo") {
    return (
      <Parrafo
        {...comun}
        marcador={campo.marcador}
        valor={typeof valor === "string" ? valor : ""}
        onCambio={(v) => onCambio(campo.id, v)}
      />
    );
  }
  if (campo.tipo === "una") {
    return (
      <Opciones
        {...comun}
        multiple={false}
        opciones={campo.opciones}
        otro={campo.otro}
        valor={valor}
        onCambio={(v) => onCambio(campo.id, v)}
      />
    );
  }
  if (campo.tipo === "varias") {
    return (
      <Opciones
        {...comun}
        multiple
        opciones={campo.opciones}
        otro={campo.otro}
        valor={valor}
        onCambio={(v) => onCambio(campo.id, v)}
      />
    );
  }
  // Explícito y no por descarte: al estrechar una unión donde un miembro
  // declara `tipo: "texto" | "parrafo"`, TypeScript no lo elimina del todo y
  // el último `return` quedaba sin estrechar.
  if (campo.tipo === "tabla") {
    return (
      <Tabla
        {...comun}
        columnas={campo.columnas}
        filas={campo.filas}
        valor={valor}
        onCambio={(v) => onCambio(campo.id, v)}
      />
    );
  }
  return null;
}

type Comun = { etiqueta: string; ayuda?: string; requerido?: boolean; falta?: boolean };

function Etiqueta({ etiqueta, ayuda, requerido, falta }: Comun) {
  return (
    <>
      <span className="block text-[14.5px] font-semibold text-foreground">
        {etiqueta}
        {requerido ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {ayuda ? (
        <span className="mt-1 block text-[13px] text-muted-foreground leading-relaxed">{ayuda}</span>
      ) : null}
      {falta ? (
        <span className="mt-1 block text-[13px] font-medium text-destructive">
          Esta hace falta para seguir.
        </span>
      ) : null}
    </>
  );
}

const CAJA =
  "mt-2.5 w-full rounded-xl border bg-background px-3.5 text-[14.5px] text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15";

function Texto({
  valor,
  onCambio,
  marcador,
  ...c
}: Comun & { valor: string; onCambio: (v: string) => void; marcador?: string }) {
  return (
    <label className="block">
      <Etiqueta {...c} />
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={marcador}
        className={`${CAJA} h-11 ${c.falta ? "border-destructive" : ""}`}
      />
    </label>
  );
}

function Parrafo({
  valor,
  onCambio,
  marcador,
  ...c
}: Comun & { valor: string; onCambio: (v: string) => void; marcador?: string }) {
  return (
    <label className="block">
      <Etiqueta {...c} />
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={marcador}
        rows={4}
        className={`${CAJA} resize-y py-3 leading-relaxed ${c.falta ? "border-destructive" : ""}`}
      />
    </label>
  );
}

function Opciones({
  opciones,
  otro,
  multiple,
  valor,
  onCambio,
  ...c
}: Comun & {
  opciones: readonly string[];
  otro?: boolean;
  multiple: boolean;
  valor: unknown;
  onCambio: (v: unknown) => void;
}) {
  const elegidas = multiple
    ? Array.isArray(valor)
      ? (valor as string[])
      : []
    : typeof valor === "string"
      ? [valor]
      : [];

  const alternar = (op: string) => {
    if (!multiple) return onCambio(elegidas[0] === op ? "" : op);
    return onCambio(elegidas.includes(op) ? elegidas.filter((x) => x !== op) : [...elegidas, op]);
  };

  return (
    <fieldset className="block">
      <legend className="block">
        <Etiqueta {...c} />
      </legend>
      <div className="mt-2.5 space-y-2">
        {opciones.map((op) => {
          const activa = elegidas.includes(op);
          return (
            <button
              key={op}
              type="button"
              aria-pressed={activa}
              onClick={() => alternar(op)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14.5px] transition ${
                activa
                  ? "border-primary bg-primary/5 font-semibold text-foreground"
                  : "bg-background text-muted-foreground hover:bg-subtle"
              }`}
            >
              <span
                aria-hidden
                className={`grid size-4 shrink-0 place-items-center border ${
                  multiple ? "rounded" : "rounded-full"
                } ${activa ? "border-primary bg-primary" : "border-border-strong"}`}
              >
                {activa ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
              </span>
              {op}
            </button>
          );
        })}
        {otro ? (
          <Texto
            etiqueta="Otro"
            valor={typeof valor === "object" && valor !== null && "otro" in valor ? String((valor as { otro?: unknown }).otro ?? "") : ""}
            onCambio={(v) =>
              onCambio(multiple ? { seleccion: elegidas, otro: v } : { seleccion: elegidas[0] ?? "", otro: v })
            }
          />
        ) : null}
      </div>
    </fieldset>
  );
}

function Tabla({
  columnas,
  filas,
  valor,
  onCambio,
  ...c
}: Comun & {
  columnas: readonly string[];
  filas: readonly string[];
  valor: unknown;
  onCambio: (v: unknown) => void;
}) {
  const actual =
    valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, Record<string, string>>)
      : {};

  const fijar = (fila: string, col: string, v: string) =>
    onCambio({ ...actual, [fila]: { ...(actual[fila] ?? {}), [col]: v } });

  return (
    <div className="block">
      <Etiqueta {...c} />
      {/* Tabla ancha: scroll propio, para que la página nunca se mueva de lado. */}
      <div className="mt-2.5 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[32rem] border-collapse">
          <thead>
            <tr className="bg-subtle">
              <th className="w-24 px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wider text-muted-foreground" />
              {columnas.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila} className="border-t">
                <th className="px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground">
                  {fila}
                </th>
                {columnas.map((col) => (
                  <td key={col} className="p-1.5">
                    <input
                      value={actual[fila]?.[col] ?? ""}
                      onChange={(e) => fijar(fila, col, e.target.value)}
                      aria-label={`${fila} · ${col}`}
                      className="h-10 w-full rounded-lg border bg-background px-2.5 text-[14px] text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Solo lo de esta sección viaja al servidor. Mandar el objeto entero haría que
 * un guardado viejo —de una pestaña abierta hace rato— sobreescribiera
 * secciones que otra pestaña acaba de contestar.
 */
function soloDeEstaSeccion(
  bloques: readonly Bloque[],
  valores: Record<string, unknown>
): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const b of bloques) {
    if (b.tipo === "nota") continue;
    if (b.id in valores) salida[b.id] = valores[b.id];
  }
  return salida;
}
