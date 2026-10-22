import { describe, expect, it } from "vitest";
import { agenteSilenciado } from "@/server/ai/silencio";

const AHORA = new Date("2026-10-21T17:00:00Z");

describe("cuándo el agente tiene que callarse", () => {
  it("sin handoff, habla", () => {
    expect(agenteSilenciado(null, null)).toBe(false);
  });

  it("CALLA solo cuando una persona contestó de verdad", () => {
    // Dos voces contestando al mismo cliente es peor que una.
    expect(agenteSilenciado(AHORA, "manual_reply")).toBe(true);
  });

  it("un fallo del proveedor NO lo calla: nadie tomó la conversación", () => {
    // El caso del 21-oct: murió por `error` y el cliente mandó tres mensajes
    // más. Con esto, esos tres lo despiertan.
    expect(agenteSilenciado(AHORA, "error")).toBe(false);
  });

  it("la ventana de 24 h tampoco: es un límite de envío, no una entrega", () => {
    expect(agenteSilenciado(AHORA, "ventana")).toBe(false);
  });

  it("que el cliente pida un humano lo marca, pero no lo apaga", () => {
    // Queda disponible por si pregunta otra cosa. Que no insista con el tema
    // escalado es cosa de las reglas de escalado, no de este guardián.
    expect(agenteSilenciado(AHORA, "cliente")).toBe(false);
    expect(agenteSilenciado(AHORA, "modelo")).toBe(false);
  });

  it("acepta la fecha como texto, que es como viaja desde la API", () => {
    expect(agenteSilenciado(AHORA.toISOString(), "manual_reply")).toBe(true);
    expect(agenteSilenciado(AHORA.toISOString(), "error")).toBe(false);
  });

  it("un motivo desconocido no calla al agente", () => {
    // Si mañana aparece un motivo nuevo, el valor por defecto es seguir
    // atendiendo: quedarse callado es el peor error de los dos.
    expect(agenteSilenciado(AHORA, "motivo_que_no_existe")).toBe(false);
    expect(agenteSilenciado(AHORA, null)).toBe(false);
  });
});
