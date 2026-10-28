import { describe, expect, it } from "vitest";
import {
  VARIANTES,
  VARIANTE_POR_DEFECTO,
  camposDe,
  esVariante,
  minutosRestantes,
  minutosTotalesDe,
  seccionesDe,
  totalDe,
} from "@/server/cuestionario/secciones";
import { seccionesContestadas } from "@/server/cuestionario/store";

const CLAVES = Object.keys(VARIANTES);

/**
 * 127 y 130 — El cuestionario de puesta en marcha y sus variantes.
 */
describe.each(CLAVES)("la variante «%s»", (v) => {
  it("ningún identificador de pregunta se repite", () => {
    // El que más importa. Las respuestas se guardan en un `jsonb` indexado POR
    // ESE ID: dos preguntas con el mismo id harían que una sobreescribiera a
    // la otra sin ningún error, y el operador leería una respuesta creyéndola
    // de otra pregunta.
    const ids = seccionesDe(v).flatMap((s) => camposDe(s).map((c) => c.id));
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("son diez secciones y todas tienen al menos una pregunta", () => {
    expect(totalDe(v)).toBe(10);
    for (const s of seccionesDe(v)) {
      expect(camposDe(s).length, `sección ${s.numero}`).toBeGreaterThan(0);
    }
  });

  it("toda opción múltiple ofrece opciones de verdad", () => {
    for (const s of seccionesDe(v)) {
      for (const c of camposDe(s)) {
        if (c.tipo === "una" || c.tipo === "varias") {
          expect(c.opciones.length, c.id).toBeGreaterThan(1);
        }
        if (c.tipo === "tabla") {
          expect(c.filas.length, c.id).toBeGreaterThan(0);
          expect(c.columnas.length, c.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it("en la primera pantalla faltan TODOS los minutos", () => {
    // Estar en la sección 1 no es haberla terminado. Si se descontara, el
    // cliente vería menos tiempo del que le queda — que es justo la
    // incertidumbre que esto viene a evitar.
    expect(minutosRestantes(v, 0)).toBe(minutosTotalesDe(v));
  });

  it("el tiempo nunca es negativo ni crece al avanzar", () => {
    let previo = Number.POSITIVE_INFINITY;
    for (let i = 0; i < totalDe(v); i++) {
      const m = minutosRestantes(v, i);
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThanOrEqual(previo);
      previo = m;
    }
  });

  it("la sección 5 es la más pesada", () => {
    // Las diez consultas frecuentes: la más larga y la más valiosa.
    const cinco = seccionesDe(v).find((s) => s.numero === 5);
    const maximo = Math.max(...seccionesDe(v).map((s) => s.minutos));
    expect(cinco?.minutos).toBe(maximo);
  });
});

describe("cómo se elige la variante (130)", () => {
  it("sin variante, la general", () => {
    expect(seccionesDe("")).toBe(VARIANTES[VARIANTE_POR_DEFECTO]);
    expect(seccionesDe(null)).toBe(VARIANTES[VARIANTE_POR_DEFECTO]);
    expect(seccionesDe(undefined)).toBe(VARIANTES[VARIANTE_POR_DEFECTO]);
  });

  it("una variante inventada cae en la general, no en un error", () => {
    // El enlace lo arma una persona: un dedazo no debe dejar al cliente sin
    // formulario, y tampoco debe revelar qué variantes existen.
    expect(seccionesDe("no-existe")).toBe(VARIANTES[VARIANTE_POR_DEFECTO]);
    expect(esVariante("no-existe")).toBe(false);
  });

  it("la de The Student Store sigue existiendo y es distinta de la general", () => {
    // Su enlace ya está en manos del cliente. Si esta prueba se pone roja,
    // alguien le movió las preguntas mientras las contestaba.
    expect(esVariante("the-student-store")).toBe(true);
    expect(seccionesDe("the-student-store")).not.toBe(seccionesDe("general"));
  });

  it("la general NO habla del rubro de ningún cliente", () => {
    // Es la razón de ser de 130: preguntar por «saldo», «matrícula» o
    // «comedor» a una concesionaria deja en evidencia que el formulario se
    // escribió para otro.
    const texto = JSON.stringify(seccionesDe("general")).toLowerCase();
    for (const palabra of ["comedor", "matrícula", "alumno", "almuerzo", "colegio"]) {
      expect(texto, `la general menciona «${palabra}»`).not.toContain(palabra);
    }
  });

  it("la de The Student Store sí habla de lo suyo", () => {
    const texto = JSON.stringify(seccionesDe("the-student-store")).toLowerCase();
    expect(texto).toContain("comedor");
  });
});

describe("cuánto contestó alguien", () => {
  it("un cuestionario vacío es cero secciones", () => {
    expect(seccionesContestadas("general", {})).toBe(0);
  });

  it("espacios en blanco no cuentan como contestado", () => {
    // Si contaran, el operador vería «3 de 10» y abriría tres secciones vacías.
    expect(seccionesContestadas("general", { "1.1": "   " })).toBe(0);
    expect(seccionesContestadas("general", { "1.1": "Panadería La Esquina" })).toBe(1);
  });

  it("una tabla con una sola celda escrita cuenta la sección", () => {
    expect(
      seccionesContestadas("general", { "5.1": { "1": { "Lo que pregunta el cliente": "precio" } } })
    ).toBe(1);
  });

  it("una tabla con todas las celdas vacías no cuenta", () => {
    expect(
      seccionesContestadas("general", { "5.1": { "1": { "Lo que pregunta el cliente": "" } } })
    ).toBe(0);
  });
});
