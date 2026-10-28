/**
 * 127 — Leer las respuestas del cuestionario de puesta en marcha.
 *
 * No hay pantalla en el panel a propósito (ver el plan de la spec): lo que
 * hace falta hoy es poder cargar el alta y armar la planilla, y el operador
 * son dos personas.
 *
 *   corepack pnpm cuestionario                      # lista lo que hay
 *   corepack pnpm cuestionario -- <llave>           # imprime uno
 *   FORMATO=tsv corepack pnpm cuestionario -- <llave>   # para pegar en la planilla
 */
import { leerPorLlave, listar, seccionesContestadas } from "@/server/cuestionario/store";
import { SECCIONES, TOTAL_SECCIONES, camposDe } from "@/server/cuestionario/secciones";

function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(comoTexto).filter(Boolean).join("; ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => {
        const s = comoTexto(x);
        return s ? `${k}: ${s}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(v);
}

async function main() {
  // `corepack pnpm cuestionario -- <llave>` deja el `--` en los argumentos y
  // node lo pasa tal cual: sin filtrarlo, el guion buscaba un cuestionario con
  // la llave "--" y decía que no existe, que parece el error del operador.
  const llave = process.argv.slice(2).find((a) => a !== "--");

  if (!llave) {
    const todos = await listar();
    if (todos.length === 0) {
      console.log("Todavía no hay ningún cuestionario completado.");
      return;
    }
    console.log(`${todos.length} cuestionario(s):\n`);
    for (const c of todos) {
      const estado = c.enviadoAt
        ? `enviado ${c.enviadoAt.toISOString().slice(0, 16).replace("T", " ")}`
        : `a medias (sección ${c.seccionActual + 1} de ${TOTAL_SECCIONES})`;
      console.log(`  ${c.cliente}`);
      console.log(`    llave:  ${c.llave}`);
      console.log(`    estado: ${estado}\n`);
    }
    console.log("Para ver uno:  corepack pnpm cuestionario -- <llave>");
    return;
  }

  const c = await leerPorLlave(llave);
  if (!c) {
    console.error(`No existe ningún cuestionario con la llave "${llave}".`);
    process.exitCode = 1;
    return;
  }

  const tsv = process.env.FORMATO === "tsv";

  if (tsv) {
    // Una fila por pregunta: pregunta <tab> respuesta. Para pegar en la planilla.
    console.log(["Sección", "Pregunta", "Respuesta"].join("\t"));
    for (const s of SECCIONES) {
      for (const campo of camposDe(s)) {
        const r = comoTexto(c.respuestas[campo.id]).replace(/[\t\n\r]+/g, " ");
        console.log([`${s.numero}. ${s.titulo}`, campo.etiqueta, r].join("\t"));
      }
    }
    return;
  }

  console.log(`\n${"=".repeat(68)}`);
  console.log(`  ${c.cliente}`);
  console.log(`  ${c.contacto ?? "sin contacto"} · ${c.correo ?? "sin correo"}`);
  console.log(
    `  ${c.enviadoAt ? "ENVIADO" : "A MEDIAS"} · ${seccionesContestadas(c.respuestas)} de ${TOTAL_SECCIONES} secciones con respuestas`
  );
  console.log(`${"=".repeat(68)}`);

  for (const s of SECCIONES) {
    const campos = camposDe(s);
    const contestados = campos.filter((x) => comoTexto(c.respuestas[x.id]).trim() !== "");
    console.log(`\n── ${s.numero} · ${s.titulo} ${contestados.length === 0 ? "(vacía)" : ""}`);
    for (const campo of contestados) {
      console.log(`\n  ${campo.etiqueta}`);
      console.log(`    ${comoTexto(c.respuestas[campo.id]).replace(/\n/g, "\n    ")}`);
    }
  }
  console.log("");
}

// `process.exit(0)` explícito, como `provision.ts` y `acceso.ts`: la conexión
// a la base queda abierta y sin esto el guion imprime y se cuelga hasta que
// vence el tiempo de espera. Parece que falló cuando ya había terminado.
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
