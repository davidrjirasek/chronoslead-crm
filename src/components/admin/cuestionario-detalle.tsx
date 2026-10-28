"use client";

import Link from "next/link";
import { SECCIONES, TOTAL_SECCIONES, camposDe } from "@/server/cuestionario/secciones";
import type { Cuestionario } from "@/server/cuestionario/store";

/**
 * 128 — Las respuestas de un cliente, para leer y para descargar.
 *
 * La descarga se arma en el navegador y no en el servidor: son los mismos
 * datos que ya están en la pantalla, así que una ruta nueva solo habría
 * sumado superficie que proteger.
 */
export function DetalleDelCuestionario({ cuestionario }: { cuestionario: Cuestionario }) {
  const descargar = () => {
    const filas = [["Sección", "Pregunta", "Respuesta"]];
    for (const s of SECCIONES) {
      for (const campo of camposDe(s)) {
        filas.push([
          `${s.numero}. ${s.titulo}`,
          campo.etiqueta,
          texto(cuestionario.respuestas[campo.id]).replace(/[\t\n\r]+/g, " "),
        ]);
      }
    }
    const tsv = filas.map((f) => f.join("\t")).join("\n");
    // Con BOM, para que Excel y Google Sheets no rompan los acentos.
    const url = URL.createObjectURL(
      new Blob(["﻿" + tsv], { type: "text/tab-separated-values;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuestionario-${cuestionario.cliente.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const contestadas = SECCIONES.filter((s) =>
    camposDe(s).some((c) => texto(cuestionario.respuestas[c.id]).trim() !== "")
  ).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/cuestionarios"
        className="text-[13.5px] font-medium text-primary hover:underline"
      >
        ← Cuestionarios
      </Link>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="font-bold text-2xl text-foreground tracking-tight">
            {cuestionario.cliente}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {cuestionario.contacto || "sin nombre de contacto"}
            {cuestionario.correo ? ` · ${cuestionario.correo}` : ""}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {cuestionario.enviadoAt ? "Enviado" : "A medias"} · {contestadas} de {TOTAL_SECCIONES}{" "}
            secciones con respuestas
          </p>
        </div>
        <button
          type="button"
          onClick={descargar}
          className="h-10 rounded-xl bg-primary px-5 text-[13.5px] font-bold text-primary-foreground transition hover:opacity-90"
        >
          Descargar para la planilla
        </button>
      </header>

      <div className="mt-8 space-y-10">
        {SECCIONES.map((s) => {
          const campos = camposDe(s).filter(
            (c) => texto(cuestionario.respuestas[c.id]).trim() !== ""
          );
          return (
            <section key={s.numero}>
              <h2 className="font-semibold text-[15px] text-foreground">
                {s.numero} · {s.titulo}
                {campos.length === 0 ? (
                  <span className="ml-2 font-normal text-[13px] text-muted-foreground">
                    (sin responder)
                  </span>
                ) : null}
              </h2>
              {campos.length > 0 ? (
                <dl className="mt-4 space-y-5">
                  {campos.map((c) => (
                    <div key={c.id}>
                      <dt className="text-[13.5px] font-medium text-muted-foreground">
                        {c.etiqueta}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-[14.5px] text-foreground">
                        {texto(cuestionario.respuestas[c.id])}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}

/** Aplana lo que haya: texto, opciones múltiples o una tabla. */
function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(texto).filter(Boolean).join("; ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => {
        const s = texto(x);
        return s ? `${k}: ${s}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(v);
}
