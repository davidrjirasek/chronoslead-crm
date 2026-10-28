import { describe, expect, it } from "vitest";
import {
  MINUTOS_TOTALES,
  SECCIONES,
  TOTAL_SECCIONES,
  camposDe,
  minutosRestantes,
} from "@/server/cuestionario/secciones";
import { seccionesContestadas } from "@/server/cuestionario/store";

/**
 * 127 — El cuestionario de puesta en marcha.
 */
describe("la estructura del cuestionario", () => {
  it("ningún identificador de pregunta se repite", () => {
    // El que más importa de este archivo. Las respuestas se guardan en un
    // `jsonb` indexado POR ESE ID: dos preguntas con el mismo id harían que
    // una sobreescribiera a la otra sin ningún error, y el operador leería
    // una respuesta creyéndola de otra pregunta.
    const ids = SECCIONES.flatMap((s) => camposDe(s).map((c) => c.id));
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("son diez secciones y todas tienen al menos una pregunta", () => {
    expect(TOTAL_SECCIONES).toBe(10);
    for (const s of SECCIONES) {
      expect(camposDe(s).length, `sección ${s.numero}`).toBeGreaterThan(0);
    }
  });

  it("las notas no son preguntas", () => {
    // Una nota explica y no pide nada. Si entrara en `camposDe` se la
    // validaría como campo obligatorio vacío y nadie podría avanzar.
    const conNota = SECCIONES.find((s) => s.bloques.some((b) => b.tipo === "nota"));
    expect(conNota).toBeDefined();
    if (!conNota) return;
    expect(camposDe(conNota).every((c) => c.tipo !== undefined)).toBe(true);
    expect(camposDe(conNota).length).toBeLessThan(conNota.bloques.length);
  });

  it("toda opción múltiple ofrece opciones de verdad", () => {
    for (const s of SECCIONES) {
      for (const c of camposDe(s)) {
        if (c.tipo === "una" || c.tipo === "varias") {
          expect(c.opciones.length, `${c.id}`).toBeGreaterThan(1);
        }
        if (c.tipo === "tabla") {
          expect(c.filas.length, `${c.id}`).toBeGreaterThan(0);
          expect(c.columnas.length, `${c.id}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("el tiempo que se le promete al cliente", () => {
  it("el total es el que dijo el dueño: veinte minutos", () => {
    expect(MINUTOS_TOTALES).toBe(20);
  });

  it("en la primera pantalla faltan TODOS los minutos", () => {
    // Estar en la sección 1 no es haberla terminado. Si se descontara, el
    // cliente vería menos tiempo del que le queda — que es justo la
    // incertidumbre que esto viene a evitar.
    expect(minutosRestantes(0)).toBe(MINUTOS_TOTALES);
  });

  it("en la última solo faltan los minutos de la última", () => {
    const ultima = SECCIONES[TOTAL_SECCIONES - 1];
    expect(ultima).toBeDefined();
    expect(minutosRestantes(TOTAL_SECCIONES - 1)).toBe(ultima?.minutos);
  });

  it("nunca es negativo ni crece al avanzar", () => {
    let previo = Number.POSITIVE_INFINITY;
    for (let i = 0; i < TOTAL_SECCIONES; i++) {
      const m = minutosRestantes(i);
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThanOrEqual(previo);
      previo = m;
    }
  });

  it("la sección 5 es la más pesada", () => {
    // Las diez consultas frecuentes: es la más larga y la más valiosa, y el
    // reparto por peso existe para no prometer que dura lo mismo que «¿cómo
    // se va a llamar el asistente?».
    const cinco = SECCIONES.find((s) => s.numero === 5);
    expect(cinco).toBeDefined();
    const maximo = Math.max(...SECCIONES.map((s) => s.minutos));
    expect(cinco?.minutos).toBe(maximo);
  });
});

describe("cuánto contestó alguien", () => {
  it("un cuestionario vacío es cero secciones", () => {
    expect(seccionesContestadas({})).toBe(0);
  });

  it("espacios en blanco no cuentan como contestado", () => {
    // Si contaran, el operador vería «3 de 10» y abriría tres secciones vacías.
    expect(seccionesContestadas({ "1.1": "   " })).toBe(0);
    expect(seccionesContestadas({ "1.1": "Colegio San José" })).toBe(1);
  });

  it("una tabla con una sola celda escrita cuenta la sección", () => {
    expect(seccionesContestadas({ "5.1": { "1": { "Lo que pregunta el padre": "saldo" } } })).toBe(1);
  });

  it("una tabla con todas las celdas vacías no cuenta", () => {
    expect(seccionesContestadas({ "5.1": { "1": { "Lo que pregunta el padre": "" } } })).toBe(0);
  });
});
