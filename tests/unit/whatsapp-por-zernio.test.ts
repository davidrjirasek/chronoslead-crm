import { describe, expect, it } from "vitest";
import { BSUID_PREFIX } from "@/server/inbox/identity";
import {
  normalizeZernioWhatsappEcho,
  normalizeZernioWhatsappInbound,
} from "@/server/whatsapp/zernio-ingest";
import { zernioAccountName } from "@/server/zernio/cuentas";
import { zernioTargetChannel } from "@/server/zernio/dispatch";

/**
 * 139 — WhatsApp por Zernio: el normalizador.
 *
 * Es función pura a propósito: qué se ingiere y qué se descarta es la parte
 * que más fácil se rompe cuando el proveedor cambia un campo, y probarlo sin
 * base de datos es lo que permite probarlo de verdad.
 */

// Fixtures inventados a propósito: un test no tiene por qué llevar el
// identificador de Zernio ni el número de un cliente, y este repo es público.
const ACCOUNT = "000000000000000000000001";
/** El número del negocio: nunca puede acabar siendo la identidad del cliente. */
const NEGOCIO = "595000000001";
const CLIENTE = "595000000002";

type Parcial = Record<string, unknown>;

/**
 * Un `message.received` de WhatsApp, con la forma de la documentación.
 *
 * `message` y `conversation` se FUSIONAN con lo que pase el test, no se
 * reemplazan: un `over` suelto al final los sobrescribiría enteros y cada
 * prueba estaría midiendo un evento al que le faltan campos que sí llegan.
 */
function entrante(over: Parcial = {}) {
  const { message, conversation, account, sender, ...resto } = over as Parcial & {
    message?: Parcial;
    conversation?: Parcial;
    account?: Parcial;
    sender?: Parcial;
  };
  const tieneCuenta = "account" in over;
  return {
    id: "evt_5f8e2a1c",
    event: "message.received",
    ...resto,
    message: {
      id: "66d4a1b2c3e4f5a6b7c8d9e1",
      conversationId: "66c3d2ae7b4f6c8d0e1f2a3b",
      platform: "whatsapp",
      direction: "incoming",
      text: "Hola, ¿hacen service de aire?",
      sentAt: "2026-11-07T14:28:53.642Z",
      ...(message ?? {}),
      // El `sender` que pasa el test REEMPLAZA al de por defecto. Fusionarlo
      // dejaría vivo el `phoneNumber` por defecto, y los casos que prueban
      // «sin identidad utilizable» pasarían por la razón equivocada.
      sender:
        (message?.sender as Parcial) ??
        sender ?? { id: CLIENTE, name: "Ana", phoneNumber: `+${CLIENTE}` },
    },
    conversation: { id: "66c3d2ae7b4f6c8d0e1f2a3b", ...(conversation ?? {}) },
    // Igual que `conversation`: si el test la pasa, es para cambiarle algo
    // (típicamente la plataforma), así que manda la del test.
    account: tieneCuenta
      ? (account ?? {})
      : { id: ACCOUNT, accountId: ACCOUNT, platform: "whatsapp" },
  };
}

/** Un `message.sent`: el saliente, que puede o no ser nuestro. */
function saliente(source: string, over: Parcial = {}) {
  const { message, conversation, account, ...resto } = over as Parcial & {
    message?: Parcial;
    conversation?: Parcial;
    account?: Parcial;
  };
  const tieneConversacion = "conversation" in over;
  const tieneCuenta = "account" in over;
  return {
    id: "evt_7a1b",
    event: "message.sent",
    ...resto,
    message: {
      id: "66d4a1b2c3e4f5a6b7c8d9ff",
      platform: "whatsapp",
      direction: "outgoing",
      source,
      text: "Sí, pasame tu dirección",
      sentAt: "2026-11-07T14:31:00.000Z",
      // En un saliente el `sender` es el NEGOCIO, no el cliente.
      sender: { id: ACCOUNT, name: "Za climatizacion" },
      ...(message ?? {}),
    },
    // Cuando el test pasa `conversation` lo hace para quitarle algo: se
    // respeta tal cual en vez de rellenarlo con el valor por defecto.
    conversation: tieneConversacion
      ? (conversation ?? {})
      : {
          id: "66c3d2ae7b4f6c8d0e1f2a3b",
          participantId: CLIENTE,
          participantName: "Ana",
        },
    account: tieneCuenta ? (account ?? {}) : { id: ACCOUNT, platform: "whatsapp" },
  };
}

describe("139 · entrantes de WhatsApp por Zernio", () => {
  it("normaliza un entrante con su identidad, su hilo y su hora", () => {
    const [m] = normalizeZernioWhatsappInbound(entrante());
    expect(m).toBeDefined();
    expect(m!.accountRef).toBe(ACCOUNT);
    expect(m!.identity).toBe(CLIENTE);
    expect(m!.phone).toBe(CLIENTE);
    expect(m!.type).toBe("text");
    expect(m!.identity).not.toBe(NEGOCIO);
    expect(m!.threadRef).toBe("66c3d2ae7b4f6c8d0e1f2a3b");
    // La hora del evento, no la de llegada: es la que abre la ventana de 24 h.
    expect(m!.timestamp).toBe(String(Math.floor(Date.parse("2026-11-07T14:28:53.642Z") / 1000)));
  });

  it("la identidad va SIN el «+», como la del transporte nativo", () => {
    // Si se guardara el «+» que trae E.164, el mismo cliente quedaría como dos
    // contactos según por dónde entró su mensaje.
    const [m] = normalizeZernioWhatsappInbound(
      entrante({ message: { sender: { id: `+${CLIENTE}`, phoneNumber: `+${CLIENTE}` } } })
    );
    expect(m!.identity).toBe(CLIENTE);
    expect(m!.phone).toBe(CLIENTE);
    expect(m!.identity.startsWith("+")).toBe(false);
  });

  it("521… y 52… son el mismo contacto (simetría de la spec 003)", () => {
    const [m] = normalizeZernioWhatsappInbound(
      entrante({ message: { sender: { id: "5215512345678" } } })
    );
    expect(m!.identity).toBe("525512345678");
  });

  it("sin teléfono cae al BSUID prefijado, no se descarta", () => {
    const [m] = normalizeZernioWhatsappInbound(
      entrante({
        message: {
          sender: { id: "usuario.sin.numero", businessScopedUserId: "17841400000000000" },
        },
      })
    );
    expect(m!.identity).toBe(`${BSUID_PREFIX}17841400000000000`);
    expect(m!.phone).toBeNull();
    expect(m!.waUserId).toBe("17841400000000000");
  });

  it("sin ninguna identidad se descarta en vez de inventar un contacto", () => {
    expect(
      normalizeZernioWhatsappInbound(entrante({ message: { sender: { id: "no-es-numero" } } }))
    ).toEqual([]);
  });

  it("un adjunto entra con su tipo en vez de perderse", () => {
    const [m] = normalizeZernioWhatsappInbound(
      entrante({ message: { text: null, attachments: [{ type: "image", url: "https://x/y.jpg" }] } })
    );
    expect(m!.type).toBe("image");
    expect(m!.text).toBeNull();
  });

  it("descarta lo que no es suyo: otra plataforma, otro evento, un saliente", () => {
    // El MISMO webhook trae las demás plataformas de esa llave.
    expect(
      normalizeZernioWhatsappInbound(entrante({ account: { id: ACCOUNT, platform: "instagram" } }))
    ).toEqual([]);
    expect(normalizeZernioWhatsappInbound(entrante({ event: "message.delivered" }))).toEqual([]);
    expect(
      normalizeZernioWhatsappInbound(entrante({ message: { direction: "outgoing" } }))
    ).toEqual([]);
    // Ni texto ni adjunto: no hay nada que ingerir.
    expect(normalizeZernioWhatsappInbound(entrante({ message: { text: null } }))).toEqual([]);
    expect(normalizeZernioWhatsappInbound(null)).toEqual([]);
  });
});

describe("139 · ecos: lo que el dueño contesta desde su teléfono", () => {
  it("un saliente de la app del teléfono SÍ es un eco", () => {
    const [e] = normalizeZernioWhatsappEcho(saliente("whatsapp_business_app"));
    expect(e).toBeDefined();
    expect(e!.toPhone).toBe(CLIENTE);
    expect(e!.text).toBe("Sí, pasame tu dirección");
  });

  it("lo que contestó el agente de Meta en ese número también", () => {
    expect(normalizeZernioWhatsappEcho(saliente("meta_business_agent"))).toHaveLength(1);
  });

  it("lo que mandamos NOSOTROS por Zernio no es un eco", () => {
    // El fallo que esto previene: si `cloud_api` entrara, cada mensaje del CRM
    // volvería, se guardaría dos veces Y pausaría al agente — el agente se
    // apagaría solo justo después de contestar por primera vez.
    expect(normalizeZernioWhatsappEcho(saliente("cloud_api"))).toEqual([]);
    // Un `source` que no conocemos tampoco: ante la duda, no escalar.
    expect(normalizeZernioWhatsappEcho(saliente("otra_cosa"))).toEqual([]);
    expect(normalizeZernioWhatsappEcho(saliente(""))).toEqual([]);
  });

  it("el cliente sale de la conversación, nunca del `sender`", () => {
    // En un saliente el `sender` es el negocio: leerlo reetiquetaría la ficha
    // del cliente con el nombre del negocio.
    const [e] = normalizeZernioWhatsappEcho(saliente("whatsapp_business_app"));
    expect(e!.toPhone).not.toBe(ACCOUNT);
    expect(e!.toPhone).toBe(CLIENTE);
    // Y sin participante no hay a quién atribuirlo: se descarta.
    expect(
      normalizeZernioWhatsappEcho(
        saliente("whatsapp_business_app", { conversation: { id: "x" } })
      )
    ).toEqual([]);
  });

  it("el eco también va sin el «+»", () => {
    const [e] = normalizeZernioWhatsappEcho(
      saliente("whatsapp_business_app", {
        conversation: { id: "x", participantId: `+${CLIENTE}` },
      })
    );
    expect(e!.toPhone).toBe(CLIENTE);
  });

  it("un entrante no es un eco, y un eco no es un entrante", () => {
    expect(normalizeZernioWhatsappEcho(entrante())).toEqual([]);
    expect(normalizeZernioWhatsappInbound(saliente("whatsapp_business_app"))).toEqual([]);
  });
});

describe("139 · reparto del webhook", () => {
  it("un evento de WhatsApp va al canal de WhatsApp", () => {
    expect(zernioTargetChannel(entrante())).toBe("whatsapp");
    // La plataforma también puede venir solo en el mensaje.
    expect(
      zernioTargetChannel({
        event: "message.received",
        message: { platform: "whatsapp" },
        account: { id: ACCOUNT },
      })
    ).toBe("whatsapp");
  });
});

describe("139 · cómo se nombra la cuenta en Ajustes", () => {
  it("un número de WhatsApp NO lleva arroba", () => {
    // La arroba es de las redes sociales. En WhatsApp el `username` es el
    // número, y «@+595 972 213571» no es ni un usuario ni un teléfono.
    expect(
      zernioAccountName({ _id: "x", platform: "whatsapp", username: "+595 972 213571" })
    ).toBe("+595 972 213571");
  });

  it("y en las redes sí la sigue llevando", () => {
    expect(
      zernioAccountName({ _id: "x", platform: "instagram", username: "za.climatizacion" })
    ).toBe("@za.climatizacion");
  });
});
