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

  /**
   * 147 — El pie de foto. WhatsApp lo manda en `image.caption`, no en
   * `text.body`, y por eso `message.text` queda en null: el dato se guardaba
   * en `media_asset` y el modelo recibía «no podés verla», perdiendo la única
   * parte del mensaje que SÍ podía entender.
   */
  it("el pie de foto llega al modelo, junto con que hay una imagen", () => {
    const leido = contenidoParaElModelo({
      type: "image",
      text: null,
      direction: "in",
      caption: "¿Tienen este modelo en roble?",
    });
    expect(leido).toContain("¿Tienen este modelo en roble?");
    expect(leido).toContain("imagen");
    // Que no puede verla sigue dicho: el pie no es una descripción de la foto.
    expect(leido).toContain("NO podés ver");
  });

  it("un pie en blanco no cambia nada", () => {
    expect(
      contenidoParaElModelo({
        type: "image",
        text: null,
        direction: "in",
        caption: "   ",
      })
    ).toContain("No podés verlo");
  });

  it("el pie de un documento también llega", () => {
    expect(
      contenidoParaElModelo({
        type: "document",
        text: null,
        direction: "in",
        caption: "Adjunto el comprobante de la transferencia",
      })
    ).toContain("comprobante de la transferencia");
  });

  it("el texto del mensaje manda sobre el pie: ahí ya hay contenido", () => {
    expect(
      contenidoParaElModelo({
        type: "audio",
        text: "transcripción de la nota",
        direction: "in",
        caption: "no debería usarse",
      })
    ).toBe("transcripción de la nota");
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
