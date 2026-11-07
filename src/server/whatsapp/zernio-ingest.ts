import { normalizeMx } from "@/lib/meta/client";
import { BSUID_PREFIX } from "@/server/inbox/identity";
import { ingestInboundMessage, ingestManualOutbound } from "@/server/inbox/ingest";
import { applyStatusUpdate } from "@/server/inbox/status";
import { getZernioWhatsappByAccountRef } from "@/server/whatsapp/credentials";
import { anuncioDeWhatsapp, type AnuncioDeOrigen } from "@/server/attribution/referral";
import { zernioSentAtSeconds, type ZernioEvent } from "@/server/zernio";

/**
 * 139 — Entrada del canal de WhatsApp cuando el transporte es Zernio.
 *
 * El canal es el mismo que el de siempre; lo que cambia es por dónde llegan
 * los mensajes. El transporte nativo los recibe de la Cloud API con la forma
 * de Meta (`entry[].changes[].value`); Zernio los entrega como eventos planos
 * con `account`, `message` y `conversation`. Se normaliza aquí, y de ahí en
 * adelante corre EL MISMO núcleo que el resto: contacto, conversación,
 * idempotencia, bus de eventos y turno del agente.
 *
 * Los normalizadores son funciones puras para poder probarlos sin base de
 * datos: qué se ingiere y qué se descarta es la parte que más fácil se rompe
 * cuando el proveedor cambia un campo.
 */

/** Un entrante ya en la forma que entiende el núcleo. */
export type ZernioWhatsappInbound = {
  /** `account.id` de Zernio: la llave de enrutado a la organización. */
  accountRef: string;
  /** Llave estable del contacto: teléfono normalizado o `bsuid:<id>`. */
  identity: string;
  phone: string | null;
  waUserId: string | null;
  profileName: string | null;
  messageId: string;
  text: string | null;
  type: string;
  /** Segundos desde epoch, como lo consume el núcleo. */
  timestamp: string;
  /** `conversationId` opaco de Zernio: hace falta para responder. */
  threadRef: string | null;
  /** 139 — El anuncio del que llegó, si llegó de uno. */
  anuncio: AnuncioDeOrigen | null;
};

/** Un saliente que NO salió del CRM: lo escribió el dueño en su teléfono. */
export type ZernioWhatsappEcho = {
  accountRef: string;
  /** Teléfono del cliente, leído de la conversación y nunca del `sender`. */
  toPhone: string;
  messageId: string;
  text: string | null;
  type: string;
  timestamp: string;
};

/**
 * Tipos de adjunto → tipo de mensaje del CRM. El adjunto no se descarga
 * todavía (Zernio lo entrega como URL temporal): el mensaje entra con su tipo
 * para que la bandeja enseñe QUÉ llegó en vez de perderlo en silencio.
 */
const ATTACHMENT_TYPE: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  file: "document",
  sticker: "sticker",
};

/**
 * Los salientes que son un eco de verdad: los que no mandó este CRM.
 *
 * `cloud_api` es lo que mandamos nosotros por Zernio y ya está guardado; si
 * entrara aquí se guardaría dos veces y, peor, pausaría al agente — se
 * apagaría solo justo después de contestar por primera vez.
 */
const ECO_AJENO = new Set(["whatsapp_business_app", "meta_business_agent"]);

/** Prefijo del id: el de Zernio vive en otro espacio que el `wamid` de Meta. */
const ID_PREFIX = "zwa_";

/**
 * El teléfono como llave de identidad, o null si eso no es un teléfono.
 *
 * **El «+» se quita a propósito.** `sender.phoneNumber` llega en E.164 con el
 * «+» y `sender.id` sin él, mientras el transporte nativo guarda lo que manda
 * Meta en `from`, que nunca lo lleva. Si se guardara tal cual, el MISMO
 * cliente quedaría como DOS contactos según por dónde entró su mensaje —y el
 * día que un número pase de un transporte al otro, su historial se partiría en
 * dos fichas sin que nada falle a la vista.
 *
 * `normalizeMx` después, para que `521…` y `52…` sigan siendo el mismo
 * contacto que en el camino nativo (spec 003).
 */
function telefonoDeLaIdentidad(crudo: string | null): string | null {
  if (!crudo) return null;
  const digits = crudo.replace(/^\+/, "");
  if (!/^\d{6,}$/.test(digits)) return null;
  return normalizeMx(digits);
}


/**
 * 139 — El anuncio Click-to-WhatsApp del que llegó la conversación.
 *
 * Zernio adjunta el `referral` de Meta **verbatim** junto a sus propios
 * campos `ctwa_*`, así que se le pasa el verbatim al normalizador que ya
 * entiende la forma de Meta (`anuncioDeWhatsapp`) en vez de escribir un
 * segundo normalizador que haya que mantener al día dos veces.
 *
 * El respaldo arma el mismo objeto con los `ctwa_*` por si un día llega el
 * desarmado sin el verbatim. Sin ninguno de los dos no hay anuncio, y la
 * conversación entra igual: llegar sin anuncio es lo normal.
 */
function anuncioDelEvento(evt: ZernioEvent): AnuncioDeOrigen | null {
  const meta = evt.message?.metadata;
  if (!meta || typeof meta !== "object") return null;

  const verbatim = anuncioDeWhatsapp(meta.referral);
  if (verbatim) return verbatim;

  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  if (!texto(meta.ctwa_clid) && !texto(meta.ctwa_source_id)) return null;
  return anuncioDeWhatsapp({
    source_id: meta.ctwa_source_id,
    source_type: meta.ctwa_source_type,
    source_url: meta.ctwa_source_url,
    headline: meta.ctwa_headline,
    body: meta.ctwa_body,
    media_type: meta.ctwa_media_type,
    ctwa_clid: meta.ctwa_clid,
    image_url: meta.ctwa_image_url,
  });
}

/** La plataforma del evento: Zernio la manda en la cuenta y en el mensaje. */
function plataforma(evt: ZernioEvent | null): string {
  return (evt?.account?.platform ?? evt?.message?.platform ?? "").toLowerCase();
}

function esDeWhatsapp(evt: ZernioEvent | null): evt is ZernioEvent {
  return Boolean(evt) && typeof evt === "object" && plataforma(evt) === "whatsapp";
}

function conTexto(evt: ZernioEvent): { text: string | null; type: string } | null {
  const text =
    typeof evt.message?.text === "string" && evt.message.text.length > 0
      ? evt.message.text
      : null;
  const adjunto = evt.message?.attachments?.[0];
  const type = text
    ? "text"
    : adjunto
      ? (ATTACHMENT_TYPE[adjunto.type ?? ""] ?? "unsupported")
      : null;
  // Ni texto ni adjunto: no hay nada que ingerir.
  return type ? { text, type } : null;
}

/**
 * Evento de Zernio → entrante de WhatsApp, o nada.
 *
 * La identidad sigue la misma regla que el transporte nativo (spec 003): el
 * teléfono si lo hay, y si no el BSUID prefijado. Así un contacto que ya
 * existía —de este canal o de una conexión anterior— es el MISMO contacto, y
 * no se duplica la ficha al cambiar de transporte.
 */
export function normalizeZernioWhatsappInbound(
  payload: unknown
): ZernioWhatsappInbound[] {
  const evt = payload as ZernioEvent | null;
  if (!esDeWhatsapp(evt)) return [];
  if (evt.event !== "message.received") return [];
  if (evt.message?.direction && evt.message.direction !== "incoming") return [];

  const accountRef = evt.account?.id ?? evt.account?.accountId;
  const messageId = evt.message?.id;
  if (!accountRef || !messageId) return [];

  const contenido = conTexto(evt);
  if (!contenido) return [];

  const sender = evt.message?.sender;
  const bsuid = sender?.businessScopedUserId?.trim() || null;
  // `sender.id` es el teléfono sin el «+» cuando se conoce; si no, el BSUID.
  const crudo = sender?.phoneNumber?.trim() || sender?.id?.trim() || null;
  const phone = telefonoDeLaIdentidad(crudo);

  const identity = phone ?? (bsuid ? `${BSUID_PREFIX}${bsuid}` : null);
  if (!identity) return []; // sin ninguna identidad no hay a quién atribuirlo

  return [
    {
      accountRef,
      identity,
      phone,
      waUserId: bsuid,
      profileName:
        sender?.name?.trim() ||
        evt.conversation?.participantName?.trim() ||
        null,
      messageId,
      ...contenido,
      timestamp: zernioSentAtSeconds(evt.message?.sentAt),
      // Opaco por contrato: se guarda tal cual y no se parsea.
      threadRef: evt.message?.conversationId ?? evt.conversation?.id ?? null,
      anuncio: anuncioDelEvento(evt),
    },
  ];
}

/**
 * Evento de Zernio → eco del teléfono, o nada.
 *
 * Solo los salientes que este CRM no mandó (`ECO_AJENO`). El cliente se lee
 * de `conversation.participantId`: en un saliente el `sender` es el propio
 * negocio, y usarlo reetiquetaría la ficha del cliente con el nombre del
 * negocio.
 */
export function normalizeZernioWhatsappEcho(
  payload: unknown
): ZernioWhatsappEcho[] {
  const evt = payload as ZernioEvent | null;
  if (!esDeWhatsapp(evt)) return [];
  if (evt.event !== "message.sent") return [];

  const source = (evt.message?.source ?? "").toLowerCase();
  if (!ECO_AJENO.has(source)) return [];

  const accountRef = evt.account?.id ?? evt.account?.accountId;
  const messageId = evt.message?.id;
  // Mismo motivo que en el entrante: sin el «+», para que el eco caiga en la
  // conversación del contacto que ya existe y no cree una ficha paralela.
  const toPhone = telefonoDeLaIdentidad(
    evt.conversation?.participantId?.trim() ?? null
  );
  if (!accountRef || !messageId || !toPhone) return [];

  const contenido = conTexto(evt);
  if (!contenido) return [];

  return [
    {
      accountRef,
      toPhone,
      messageId,
      ...contenido,
      timestamp: zernioSentAtSeconds(evt.message?.sentAt),
    },
  ];
}

/**
 * 139 — El estado de un saliente: de «enviado» a «entregado» a «leído».
 *
 * WhatsApp declara acuses de entrega, así que el saliente nace `pending` y
 * espera. Por el transporte nativo lo mueven los `statuses` de Meta; por
 * Zernio llegan como eventos propios, y hasta que se atendieron el mensaje
 * llegaba al cliente pero se quedaba con el reloj puesto para siempre — el
 * operador no sabía si había salido.
 *
 * El id es el de Zernio, sin prefijo: es el mismo que devolvió el envío y que
 * se guardó en `wa_message_id`. Los ENTRANTES sí van prefijados (`zwa_`), y
 * no se cruzan porque un entrante nunca recibe acuses.
 */
const ESTADO_POR_EVENTO: Record<string, string> = {
  // Nuestro propio envío, confirmado por la plataforma.
  "message.sent": "sent",
  "message.delivered": "delivered",
  "message.read": "read",
  "message.failed": "failed",
};

export function estadoZernioWhatsapp(
  payload: unknown
): { accountRef: string; id: string; status: string; error?: string } | null {
  const evt = payload as ZernioEvent | null;
  if (!esDeWhatsapp(evt)) return null;
  const status = ESTADO_POR_EVENTO[evt.event ?? ""];
  if (!status) return null;

  // Un `message.sent` que NO mandamos nosotros es un eco, no un acuse: lo
  // atiende `normalizeZernioWhatsappEcho` y aquí no tiene nada que hacer.
  if (evt.event === "message.sent") {
    const source = (evt.message?.source ?? "").toLowerCase();
    if (source !== "cloud_api") return null;
  }

  const accountRef = evt.account?.id ?? evt.account?.accountId;
  const id = evt.message?.id;
  if (!accountRef || !id) return null;
  return { accountRef, id, status };
}

/** La organización de una cuenta de Zernio, o un aviso de por qué no hay. */
async function organizacionDe(accountRef: string): Promise<string | null> {
  const creds = await getZernioWhatsappByAccountRef(accountRef);
  if (!creds) {
    console.warn(
      `[whatsapp/zernio] evento para una cuenta desconocida (${accountRef}): ` +
        "guarda la conexión en Ajustes → WhatsApp para recibir mensajes"
    );
    return null;
  }
  return creds.organizationId;
}

export async function processZernioWhatsappEvent(
  payload: unknown
): Promise<void> {
  for (const evt of normalizeZernioWhatsappInbound(payload)) {
    const organizationId = await organizacionDe(evt.accountRef);
    if (!organizationId) continue;
    await ingestInboundMessage({
      organizationId,
      identity: {
        identity: evt.identity,
        channel: "whatsapp",
        phone: evt.phone,
        waUserId: evt.waUserId,
        profileName: evt.profileName,
      },
      waMessageId: `${ID_PREFIX}${evt.messageId}`,
      type: evt.type,
      text: evt.text,
      timestamp: evt.timestamp,
      threadRef: evt.threadRef,
      anuncio: evt.anuncio,
    });
  }

  const acuse = estadoZernioWhatsapp(payload);
  if (acuse) {
    const organizationId = await organizacionDe(acuse.accountRef);
    if (organizationId) {
      await applyStatusUpdate(organizationId, {
        id: acuse.id,
        status: acuse.status,
        timestamp: zernioSentAtSeconds(undefined),
      });
    }
  }

  for (const eco of normalizeZernioWhatsappEcho(payload)) {
    const organizationId = await organizacionDe(eco.accountRef);
    if (!organizationId) continue;
    await ingestManualOutbound(organizationId, {
      toPhone: eco.toPhone,
      messageId: `${ID_PREFIX}${eco.messageId}`,
      type: eco.type,
      text: eco.text,
      timestamp: eco.timestamp,
    });
  }
}
