import { describe, expect, it } from "vitest";
import { tituloDePestana } from "@/lib/branding";

/**
 * 141 — El título de la pestaña distingue al cliente.
 *
 * Pedido del dueño el 8-nov-2026: con Creativo 4D, Castell y ZA Climatización
 * abiertos a la vez, las tres pestañas decían «ChronosLead — CRM multicanal».
 */
describe("141 · el título de la pestaña", () => {
  it("pone al cliente PRIMERO, porque la pestaña se recorta por la derecha", () => {
    const titulo = tituloDePestana({
      organizacion: "Castell Muebles",
      marca: "ChronosLead",
      producto: "CRM multicanal",
    });
    expect(titulo).toBe("Castell Muebles · ChronosLead");
    // Lo que distingue tiene que entrar en los primeros caracteres: con la
    // marca adelante, tres pestañas se verían «ChronosLe…» y seguiría sin
    // poder distinguirse cuál es cuál.
    expect(titulo.startsWith("Castell")).toBe(true);
  });

  it("dos clientes distintos dan títulos distintos desde el primer carácter", () => {
    const a = tituloDePestana({
      organizacion: "Castell Muebles",
      marca: "ChronosLead",
      producto: "CRM multicanal",
    });
    const b = tituloDePestana({
      organizacion: "ZA Climatización",
      marca: "ChronosLead",
      producto: "CRM multicanal",
    });
    expect(a).not.toBe(b);
    expect(a.slice(0, 8)).not.toBe(b.slice(0, 8));
  });

  it("sin organización conserva el título de siempre", () => {
    // El apex, el panel de superadmin, una dirección que no es de nadie: ahí
    // no hay cliente que nombrar.
    expect(
      tituloDePestana({
        organizacion: null,
        marca: "ChronosLead",
        producto: "CRM multicanal",
      })
    ).toBe("ChronosLead — CRM multicanal");
  });

  it("un nombre en blanco cuenta como sin organización", () => {
    expect(
      tituloDePestana({
        organizacion: "   ",
        marca: "ChronosLead",
        producto: "CRM de WhatsApp",
      })
    ).toBe("ChronosLead — CRM de WhatsApp");
  });

  it("respeta la marca propia del cliente si la personalizó", () => {
    expect(
      tituloDePestana({
        organizacion: "Castell Muebles",
        marca: "Castell CRM",
        producto: "CRM multicanal",
      })
    ).toBe("Castell Muebles · Castell CRM");
  });
});
