import { describe, expect, it } from "vitest";
import {
  mediaDeZernio,
  normalizeZernioWhatsappEcho,
  normalizeZernioWhatsappInbound,
} from "@/server/whatsapp/zernio-ingest";

/**
 * 149 — Los adjuntos que llegan por Zernio.
 *
 * El 19-nov-2026 un cliente de Castell mandó una foto pidiendo un presupuesto
 * y el agente contestó que no podía verla. Tirando del hilo apareció algo más
 * grande: **por Zernio el archivo no se guardaba nunca**. El normalizador se
 * quedaba con el texto y el tipo, y tiraba la URL.
 *
 * Lo que eso rompía, por orden de cuánto engaña:
 *  - la bandeja decía «imagen» y al hacer clic no había nada;
 *  - un PDF entraba como «documento» y el archivo no quedaba;
 *  - **las notas de voz no se transcribían**, porque el transcriptor sale en
 *    `if (!msg.mediaAssetId) return` — y el health decía `transcripcion: true`,
 *    que era cierto y aun así no alcanzaba;
 *  - y dejaba sin sentido la visión: no habría foto que mandarle al modelo.
 */

const ACCOUNT = "665f1c2e8b3a4d0012345678";

function evento(mensaje: Record<string, unknown> = {}) {
  return {
    event: "message.received",
    account: { id: ACCOUNT, platform: "whatsapp" },
    message: {
      id: "665f0001",
      conversationId: "664a0001",
      direction: "incoming",
      sender: { id: "595981111111", phoneNumber: "595981111111", name: "Fernando" },
      sentAt: "2026-11-19T12:00:00.000Z",
      ...mensaje,
    },
  };
}

describe("el adjunto viaja con su URL", () => {
  it("una foto sin texto entra como imagen y con de dónde bajarla", () => {
    const [evt] = normalizeZernioWhatsappInbound(
      evento({ attachments: [{ type: "image", url: "https://cdn.zernio/x.jpg" }] })
    );
    expect(evt?.type).toBe("image");
    expect(evt?.adjunto).toEqual({
      kind: "image",
      url: "https://cdn.zernio/x.jpg",
    });
  });

  it("un PDF entra como documento y también con su URL", () => {
    const [evt] = normalizeZernioWhatsappInbound(
      evento({ attachments: [{ type: "file", url: "https://cdn.zernio/c.pdf" }] })
    );
    expect(evt?.type).toBe("document");
    expect(evt?.adjunto?.url).toBe("https://cdn.zernio/c.pdf");
  });

  it("una nota de voz también: sin esto no hay nada que transcribir", () => {
    const [evt] = normalizeZernioWhatsappInbound(
      evento({ attachments: [{ type: "audio", url: "https://cdn.zernio/a.ogg" }] })
    );
    expect(evt?.type).toBe("audio");
    expect(evt?.adjunto?.kind).toBe("audio");
  });

  it("un texto no trae adjunto, y eso no es un hueco", () => {
    const [evt] = normalizeZernioWhatsappInbound(
      evento({ text: "Hola, quiero un presupuesto" })
    );
    expect(evt?.type).toBe("text");
    expect(evt?.adjunto).toBeNull();
  });

  it("un adjunto de un tipo que no conocemos entra igual, sin archivo", () => {
    const [evt] = normalizeZernioWhatsappInbound(
      evento({ attachments: [{ type: "lo_que_sea", url: "https://x" }] })
    );
    expect(evt?.type).toBe("unsupported");
    expect(evt?.adjunto).toBeNull();
  });

  it("un adjunto sin URL no inventa una", () => {
    const [evt] = normalizeZernioWhatsappInbound(
      evento({ attachments: [{ type: "image" }] })
    );
    expect(evt?.type).toBe("image");
    expect(evt?.adjunto).toBeNull();
  });
});

describe("el eco del teléfono también", () => {
  it("lo que el negocio mandó desde su app entra con su archivo", () => {
    const [eco] = normalizeZernioWhatsappEcho({
      event: "message.sent",
      account: { id: ACCOUNT, platform: "whatsapp" },
      conversation: { participantId: "595981111111" },
      message: {
        id: "665f0002",
        source: "whatsapp_business_app",
        sentAt: "2026-11-19T12:05:00.000Z",
        attachments: [{ type: "image", url: "https://cdn.zernio/salida.jpg" }],
      },
    });
    expect(eco?.type).toBe("image");
    expect(eco?.adjunto?.url).toBe("https://cdn.zernio/salida.jpg");
  });
});

describe("la traducción a lo que entiende la ingesta", () => {
  it("nace pendiente: el archivo todavía no está en disco", () => {
    const m = mediaDeZernio({ kind: "image", url: "https://cdn/x.jpg" });
    expect(m).toMatchObject({
      kind: "image",
      sourceUrl: "https://cdn/x.jpg",
      fetchStatus: "pending",
    });
  });

  it("sin media id de Graph: es el camino de Zernio, no el de Meta", () => {
    expect(mediaDeZernio({ kind: "audio", url: "https://cdn/a.ogg" })?.waMediaId).toBeNull();
  });

  it("sin adjunto no se arma nada", () => {
    expect(mediaDeZernio(null)).toBeNull();
  });
});
