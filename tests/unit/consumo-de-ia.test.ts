import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizarConsumo } from "@/server/ai/consumo";

const RAIZ = path.resolve(__dirname, "..", "..");

describe("el consumo que manda el proveedor", () => {
  it("lee los tres números del dialecto OpenAI", () => {
    expect(
      normalizarConsumo({
        prompt_tokens: 1200,
        completion_tokens: 80,
        total_tokens: 1280,
      })
    ).toEqual({ promptTokens: 1200, completionTokens: 80, totalTokens: 1280 });
  });

  it("si falta el total, lo deduce de las partes", () => {
    // Deducir hacia abajo y no inventar: la factura la mira una persona.
    expect(normalizarConsumo({ prompt_tokens: 900, completion_tokens: 60 })).toEqual({
      promptTokens: 900,
      completionTokens: 60,
      totalTokens: 960,
    });
  });

  it("tolera que falte cualquiera de los números", () => {
    expect(normalizarConsumo({ total_tokens: 500 })).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 500,
    });
  });

  describe("cuándo NO hay nada que anotar", () => {
    it("sin objeto de consumo", () => {
      expect(normalizarConsumo(undefined)).toBeNull();
      expect(normalizarConsumo(null)).toBeNull();
      expect(normalizarConsumo("1200")).toBeNull();
    });

    it("con todo en cero: una fila de ceros solo ensucia", () => {
      expect(normalizarConsumo({})).toBeNull();
      expect(
        normalizarConsumo({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })
      ).toBeNull();
    });

    it("valores imposibles no se cuelan", () => {
      expect(
        normalizarConsumo({ prompt_tokens: -5, completion_tokens: NaN })
      ).toBeNull();
      expect(
        normalizarConsumo({ prompt_tokens: "mil" as unknown as number })
      ).toBeNull();
    });
  });
});

describe("qué se anota, y cuándo", () => {
  const fuente = readFileSync(path.join(RAIZ, "src", "lib", "ai", "index.ts"), "utf8");

  it("se anota CADA intento, no solo el que sirvió", () => {
    // Un turno que falla el formato gasta hasta tres llamadas y se pagan las
    // tres. Contar solo el bueno escondería justo el gasto que interesa.
    expect(fuente).toContain('anotar("sin_json")');
    expect(fuente).toContain('anotar("no_cumple_esquema")');
    expect(fuente).toContain('anotar("ok")');
  });

  it("distingue el agente del juez del Laboratorio", () => {
    expect(fuente).toMatch(/proposito: opts\?\.judge \? "juez" : "agente"/);
  });

  it("el adaptador deja de descartar el consumo", () => {
    expect(fuente).toContain("normalizarConsumo(json.usage)");
  });
});

describe("anotar nunca puede tumbar un turno", () => {
  const fuente = readFileSync(
    path.join(RAIZ, "src", "server", "ai", "consumo.ts"),
    "utf8"
  );

  it("la escritura va dentro de un try/catch", () => {
    const cuerpo = fuente.slice(fuente.indexOf("export async function anotarConsumo"));
    expect(cuerpo).toContain("try {");
    expect(cuerpo).toContain("catch");
  });

  it("sin organización no se anota: una fila sin dueño no se puede cobrar", () => {
    expect(fuente).toContain("if (!opts.organizationId || !opts.consumo) return;");
  });
});
