import { describe, expect, it } from "vitest";
import { motivoDeFirmaRechazada } from "@/server/inbox/webhook";

describe("por qué se rechazó la firma de un webhook", () => {
  it("el caso del 23-oct: firma presente que no cuadra", () => {
    // Es el que cortó TODOS los mensajes entrantes y no dejó rastro. El texto
    // tiene que nombrar la causa probable, porque quien lo lee a la 1 de la
    // mañana no va a deducirla.
    const m = motivoDeFirmaRechazada("sha256=abc123");
    expect(m).toContain("META_APP_SECRET");
    expect(m).toContain("otra app");
  });

  it("sin cabecera: probablemente no es Meta quien golpea", () => {
    expect(motivoDeFirmaRechazada(null)).toContain("no vino la cabecera");
  });

  it("cabecera con formato raro, que no es ninguno de los dos anteriores", () => {
    expect(motivoDeFirmaRechazada("sha1=abc")).toContain("formato esperado");
  });

  it("NUNCA repite la firma recibida: va a un registro que lee cualquiera", () => {
    const firma = "sha256=9f8e7d6c5b4a";
    expect(motivoDeFirmaRechazada(firma)).not.toContain("9f8e7d6c5b4a");
  });

  it("los tres motivos son distintos entre sí: si no, no sirven para diagnosticar", () => {
    const todos = [
      motivoDeFirmaRechazada(null),
      motivoDeFirmaRechazada("sha1=x"),
      motivoDeFirmaRechazada("sha256=x"),
    ];
    expect(new Set(todos).size).toBe(3);
  });
});
