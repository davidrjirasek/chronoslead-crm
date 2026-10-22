import { describe, expect, it } from "vitest";
import { contenidoParaElModelo } from "@/server/ai/contenido";

const entrante = (type: string, text: string | null = null) => ({
  type,
  text,
  direction: "in",
});

describe("qué lee el modelo de cada mensaje", () => {
  it("un mensaje de texto pasa tal cual", () => {
    expect(contenidoParaElModelo(entrante("text", "Hola, quiero info"))).toBe(
      "Hola, quiero info"
    );
  });

  it("UNA NOTA DE VOZ ya no desaparece: se describe", () => {
    // El bug del 21-oct: el audio se filtraba, el turno llegaba al modelo con la
    // conversación terminando en su propia respuesta, y el proveedor devolvía
    // vacío. El agente se callaba para siempre.
    const leido = contenidoParaElModelo(entrante("audio"));
    expect(leido).not.toBeNull();
    expect(leido).toContain("nota de voz");
    expect(leido).toContain("No podés");
  });

  it("describe también lo demás que llega sin texto", () => {
    expect(contenidoParaElModelo(entrante("image"))).toContain("una imagen");
    expect(contenidoParaElModelo(entrante("video"))).toContain("un video");
    expect(contenidoParaElModelo(entrante("document"))).toContain("un documento");
    expect(contenidoParaElModelo(entrante("location"))).toContain("una ubicación");
  });

  it("un tipo que no conocemos no rompe el turno: se nombra genérico", () => {
    expect(contenidoParaElModelo(entrante("tipo_nuevo_de_meta"))).toContain(
      "un archivo"
    );
  });

  it("si el adjunto trae texto, manda el texto", () => {
    // Una imagen con pie de foto: lo que el cliente escribió vale más que
    // decir que mandó una imagen.
    expect(contenidoParaElModelo(entrante("image", "¿Tienen este modelo?"))).toBe(
      "¿Tienen este modelo?"
    );
  });

  it("un texto en blanco cuenta como sin texto", () => {
    expect(contenidoParaElModelo(entrante("audio", "   "))).toContain("nota de voz");
  });

  it("lo SALIENTE sin texto se omite: no le cambia el turno al agente", () => {
    expect(
      contenidoParaElModelo({ type: "image", text: null, direction: "out" })
    ).toBeNull();
  });
});
