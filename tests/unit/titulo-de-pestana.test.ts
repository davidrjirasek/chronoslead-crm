import { describe, expect, it } from "vitest";
import { LEMA, tituloDePestana } from "@/lib/branding";

/**
 * 141 — El título de la pestaña dice en qué estás parado.
 *
 * Pedido del dueño el 8-nov-2026: con Creativo 4D, Castell y ZA Climatización
 * abiertos a la vez, las tres pestañas decían «ChronosLead — CRM multicanal».
 */
const MARCA = "ChronosLead";
const PRODUCTO = "CRM multicanal";
const titulo = (superficie: Parameters<typeof tituloDePestana>[0]["superficie"]) =>
  tituloDePestana({ superficie, marca: MARCA, producto: PRODUCTO });

describe("141 · la pestaña de un cliente", () => {
  it("pone al cliente PRIMERO, porque la pestaña se recorta por la derecha", () => {
    const t = titulo({ kind: "tenant", organizacion: "Castell Muebles" });
    expect(t).toBe("Castell Muebles · ChronosLead");
    // Con la marca adelante, tres pestañas se verían «ChronosLe…» y seguiría
    // sin poder distinguirse cuál es cuál.
    expect(t.startsWith("Castell")).toBe(true);
  });

  it("dos clientes difieren desde el primer carácter", () => {
    const a = titulo({ kind: "tenant", organizacion: "Castell Muebles" });
    const b = titulo({ kind: "tenant", organizacion: "ZA Climatización" });
    expect(a.slice(0, 8)).not.toBe(b.slice(0, 8));
  });

  it("un nombre en blanco cae al título de siempre, no inventa uno", () => {
    expect(titulo({ kind: "tenant", organizacion: "   " })).toBe(
      "ChronosLead — CRM multicanal"
    );
    expect(titulo({ kind: "tenant", organizacion: null })).toBe(
      "ChronosLead — CRM multicanal"
    );
  });

  it("respeta la marca propia si el cliente la personalizó", () => {
    expect(
      tituloDePestana({
        superficie: { kind: "tenant", organizacion: "Castell Muebles" },
        marca: "Castell CRM",
        producto: PRODUCTO,
      })
    ).toBe("Castell Muebles · Castell CRM");
  });
});

describe("141 · cada puerta de la plataforma dice lo suyo", () => {
  it("la landing pública lleva la marca y el lema", () => {
    // Acá lo que distingue ES la marca, y este título es el que sale en Google
    // y en la vista previa al compartir el enlace.
    const t = titulo({ kind: "landing" });
    expect(t).toBe(`ChronosLead, ${LEMA}`);
    expect(t.startsWith("ChronosLead")).toBe(true);
  });

  it("y las demás puertas, su nombre primero", () => {
    expect(titulo({ kind: "admin" })).toBe("Panel de control · ChronosLead");
    expect(titulo({ kind: "cuentas" })).toBe("Cuentas · ChronosLead");
    expect(titulo({ kind: "alta" })).toBe("Alta · ChronosLead");
    expect(titulo({ kind: "onboarding" })).toBe("Cuestionario · ChronosLead");
  });

  it("una dirección que no es de nadie no nombra a nadie", () => {
    expect(titulo({ kind: "desconocido" })).toBe("ChronosLead — CRM multicanal");
  });

  it("las siete superficies dan títulos distintos entre sí", () => {
    // Si dos coincidieran, volveríamos al problema que esto vino a resolver.
    const todos = [
      titulo({ kind: "tenant", organizacion: "Castell Muebles" }),
      titulo({ kind: "landing" }),
      titulo({ kind: "admin" }),
      titulo({ kind: "cuentas" }),
      titulo({ kind: "alta" }),
      titulo({ kind: "onboarding" }),
      titulo({ kind: "desconocido" }),
    ];
    expect(new Set(todos).size).toBe(todos.length);
  });
});
