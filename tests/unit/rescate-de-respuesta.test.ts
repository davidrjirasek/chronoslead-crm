import { describe, expect, it } from "vitest";
import { respuestaRescatable } from "@/server/ai/rescate";

describe("rescatar una respuesta que vino sin envoltorio", () => {
  it("rescata la frase que se perdió el 21-oct con la nota de voz de Fernando", () => {
    // Esto es textual del log de producción. El modelo contestó bien; lo único
    // que faltó fue el objeto JSON alrededor.
    const real =
      "Entiendo. ¿Con qué agencia o de qué forma están manejando ahora las " +
      "campañas, y qué sentís que les está faltando para que funcione mejor?";
    expect(respuestaRescatable(real)).toBe(real);
  });

  it("recorta los espacios de los bordes", () => {
    expect(respuestaRescatable("  Hola, ¿en qué te ayudo?  ")).toBe(
      "Hola, ¿en qué te ayudo?"
    );
  });

  describe("lo que NO se manda", () => {
    it("nada vacío", () => {
      expect(respuestaRescatable("")).toBeNull();
      expect(respuestaRescatable("   \n  ")).toBeNull();
      expect(respuestaRescatable(null)).toBeNull();
      expect(respuestaRescatable(undefined)).toBeNull();
    });

    it("un JSON a medio romper: es el envoltorio, no una frase", () => {
      expect(respuestaRescatable('{"action": "reply", "text": "hola"')).toBeNull();
      expect(respuestaRescatable('[{"action":')).toBeNull();
      expect(respuestaRescatable('```json\n{"action": "reply"}\n```')).toBeNull();
    });

    it("cualquier texto que delate la maquinaria", () => {
      // Un cliente nunca tiene que leer la palabra JSON.
      expect(
        respuestaRescatable("No puedo responder en formato JSON, disculpá.")
      ).toBeNull();
      expect(
        respuestaRescatable("Mi respuesta no cumple el esquema del sistema.")
      ).toBeNull();
    });

    it("un texto larguísimo: no es un mensaje de chat", () => {
      expect(respuestaRescatable("a".repeat(1201))).toBeNull();
      expect(respuestaRescatable("a".repeat(1200))).toBe("a".repeat(1200));
    });
  });
});
