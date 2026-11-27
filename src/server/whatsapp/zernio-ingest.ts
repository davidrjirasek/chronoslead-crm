import { normalizeMx } from "@/lib/meta/client";
import { and, desc, eq } from "drizzle-orm";
import { BSUID_PREFIX, findContactByIdentity } from "@/server/inbox/identity";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { registrarAnuncioDeOrigen } from "@/server/attribution/store";
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
  /** 149 — El archivo, para bajarlo antes de que la URL caduque. */
  adjunto: AdjuntoDeZernio | null;
};

/** Un saliente que NO salió del CRM: lo escribió el dueño en su teléfono. */
/**
 * 149 — El adjunto, tal como lo entrega Zernio: un tipo y una URL temporal.
 * Sin nombre de archivo ni mime — el mime sale del `content-type` al bajarlo.
 */
export type AdjuntoDeZernio = {
  kind: "image" | "video" | "audio" | "document" | "sticker";
  url: string;
};

export type ZernioWhatsappEcho = {
  accountRef: string;
  /** Teléfono del cliente, leído de la conversación y nunca del `sender`. */
  toPhone: string;
  messageId: string;
  text: string | null;
  type: string;
  timestamp: string;
  adjunto: AdjuntoDeZernio | null;
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
  return anuncioDeMetadata(meta);
}

/**
 * 144 — La lectura del anuncio, compartida por los dos caminos: el `metadata`
 * del mensaje (que hoy llega vacío) y el de la conversación (que es el que
 * trae el dato). Una sola función para no mantener dos al día.
 */
function anuncioDeMetadata(
  meta: Record<string, unknown>
): AnuncioDeOrigen | null {
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
    /**
     * 144 — Zernio NO manda `ctwa_image_url`. En los anuncios reales de
     * Cerritos manda `ctwa_thumbnail_url`, y para los de video además
     * `ctwa_video_url`. Con el nombre viejo la tarjeta salía siempre con el
     * megáfono gris en vez del creativo.
     */
    image_url: meta.ctwa_image_url ?? meta.ctwa_thumbnail_url,
  });
}

/** La plataforma del evento: Zernio la manda en la cuenta y en el mensaje. */
function plataforma(evt: ZernioEvent | null): string {
  return (evt?.account?.platform ?? evt?.message?.platform ?? "").toLowerCase();
}

function esDeWhatsapp(evt: ZernioEvent | null): evt is ZernioEvent {
  return Boolean(evt) && typeof evt === "object" && plataforma(evt) === "whatsapp";
}

function conTexto(evt: ZernioEvent): {
  text: string | null;
  type: string;
  adjunto: AdjuntoDeZernio | null;
} | null {
  const text =
    typeof evt.message?.text === "string" && evt.message.text.length > 0
      ? evt.message.text
      : null;
  const adjunto = evt.message?.attachments?.[0];
  const kind = adjunto ? ATTACHMENT_TYPE[adjunto.type ?? ""] : null;
  const type = text ? "text" : adjunto ? (kind ?? "unsupported") : null;
  // Ni texto ni adjunto: no hay nada que ingerir.
  if (!type) return null;

  // 149 — La URL viaja. Antes se descartaba acá mismo y el archivo no se
  // guardaba nunca: la bandeja decía «imagen» y no había imagen, los PDF no
  // quedaban, y las notas de voz no se transcribían porque el transcriptor
  // necesita el archivo.
  const url = typeof adjunto?.url === "string" ? adjunto.url.trim() : "";
  return {
    text,
    type,
    adjunto: kind && url ? { kind: kind as AdjuntoDeZernio["kind"], url } : null,
  };
}

/**
 * 149 — Adjunto de Zernio → la forma que entiende la ingesta.
 *
 * Nace `pending`: el archivo todavía no está en disco. Quien ingiere dispara
 * la descarga en el acto —la URL es temporal— y si falla, el mensaje queda
 * igual con el adjunto en `failed`.
 */
export function mediaDeZernio(adjunto: AdjuntoDeZernio | null) {
  if (!adjunto) return null;
  return {
    kind: adjunto.kind,
    waMediaId: null,
    sourceUrl: adjunto.url,
    mimeType: null,
    fileName: null,
    caption: null,
    payload: null,
    fetchStatus: "pending" as const,
  };
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
 * 144 — El anuncio que abrió una conversación, desde `conversation.started`.
 *
 * Por qué hace falta un camino aparte: el `message.received` de Zernio llega
 * SIN `metadata`, así que por ahí el anuncio no entra nunca. Se comprobó
 * leyendo las entregas reales del webhook (27-nov): 290 entregas, ninguna con
 * el dato, mientras las mismas conversaciones sí lo tenían en Zernio.
 *
 * Se ata por la identidad —teléfono o BSUID— y no por el id de conversación
 * de Zernio, porque ese id no se guarda en nuestra base.
 */
export function anuncioDeConversacionZernio(
  payload: unknown
): { accountRef: string; identity: string; anuncio: AnuncioDeOrigen } | null {
  const evt = payload as ZernioEvent | null;
  if (!esDeWhatsapp(evt)) return null;
  if (evt.event !== "conversation.started") return null;
  // El de prueba trae ids inventados: respondemos 200 y no tocamos datos.
  if (evt.test) return null;

  const accountRef = evt.account?.id ?? evt.account?.accountId;
  if (!accountRef) return null;

  const conv = evt.conversation;
  const meta = conv?.metadata;
  if (!meta || typeof meta !== "object") return null;

  const anuncio = anuncioDeMetadata(meta as Record<string, unknown>);
  if (!anuncio) return null;

  // `participantId` es el teléfono sin «+»; `participantUsername` lo trae con él.
  const crudo =
    conv?.participantUsername?.trim() || conv?.participantId?.trim() || null;
  const phone = telefonoDeLaIdentidad(crudo);
  const identity = phone ?? null;
  if (!identity) return null;

  return { accountRef, identity, anuncio };
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
 * **Se prueban LOS DOS identificadores del evento**, y no uno elegido de
 * antemano: Zernio llama al mismo mensaje de dos formas —su id interno
 * (`message.id`) y el `wamid` de Meta (`message.platformMessageId`)— y cuál de
 * los dos devolvió el envío no está documentado. Apostar por uno dejaba el
 * saliente con el reloj puesto para siempre, que fue justo lo que pasó en la
 * prueba en vivo del 7-nov: los tres acuses llegaron, respondimos 200, y
 * ninguno encontró el mensaje.
 *
 * Probar los dos es inocuo: el que no corresponde no encuentra fila y no hace
 * nada, y el avance de estado es monótono.
 *
 * Los ENTRANTES van prefijados (`zwa_`) y no se cruzan con esto: un entrante
 * nunca recibe acuses.
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
): { accountRef: string; ids: string[]; status: string } | null {
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
  const ids = [evt.message?.id, evt.message?.platformMessageId].filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  if (!accountRef || ids.length === 0) return null;
  return { accountRef, ids: [...new Set(ids)], status };
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
      media: mediaDeZernio(evt.adjunto),
      timestamp: evt.timestamp,
      threadRef: evt.threadRef,
      anuncio: evt.anuncio,
    });
  }

  const acuse = estadoZernioWhatsapp(payload);
  if (acuse) {
    const organizationId = await organizacionDe(acuse.accountRef);
    if (organizationId) {
      for (const id of acuse.ids) {
        await applyStatusUpdate(organizationId, {
          id,
          status: acuse.status,
          timestamp: zernioSentAtSeconds(undefined),
        });
      }
    }
  }

  // 144 — El anuncio llega en su propio evento, no pegado al mensaje. Puede
  // llegar ANTES que el primer mensaje: entonces todavía no hay conversación
  // a la que atarlo y se deja pasar sin ruido. Lo que se pierda por esa
  // carrera lo recupera `scripts/recuperar-anuncios.ts`, que lee lo mismo
  // desde la API de Zernio.
  const deAnuncio = anuncioDeConversacionZernio(payload);
  if (deAnuncio) {
    const organizationId = await organizacionDe(deAnuncio.accountRef);
    if (organizationId) {
      try {
        await registrarAnuncioDeConversacion(
          organizationId,
          deAnuncio.identity,
          deAnuncio.anuncio
        );
      } catch (err) {
        // El anuncio es contexto: que falle no puede tumbar la entrega, o
        // Zernio reintenta y acaba desactivando el webhook de todos.
        console.warn(
          "[whatsapp/zernio] no se registró el anuncio de la conversación:",
          err instanceof Error ? err.message : err
        );
      }
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
      media: mediaDeZernio(eco.adjunto),
    });
  }
}

/**
 * 144 — Cuánto esperar a que entre el primer mensaje.
 *
 * `conversation.started` llega ANTES que el `message.received` que crea la
 * conversación: Zernio abre el hilo y después entrega el mensaje. Medido en
 * producción el 27-nov, el primer intento no encontró nada y el anuncio se
 * perdió en silencio.
 *
 * Por eso se reintenta en vez de rendirse al primer no. Diez intentos de a un
 * segundo y medio: de sobra para una diferencia que es de milisegundos, y
 * acotado para no dejar trabajo colgando si el mensaje nunca llega (puede
 * pasar: alguien abre el chat desde el anuncio y no escribe).
 */
const INTENTOS = 10;
const ESPERA_MS = 1500;

/**
 * Ata el anuncio a la conversación de WhatsApp de ese contacto.
 *
 * Toma la ÚLTIMA conversación del contacto en este canal. `registrarAnuncioDeOrigen`
 * es idempotente —el primer anuncio gana, por el UNIQUE de (organización,
 * conversación)—, así que un reintento de Zernio no duplica ni pisa.
 *
 * `reintentar` va en false desde el recuperador: ahí la conversación o existe
 * o no existe, y esperar no cambia nada.
 */
export async function registrarAnuncioDeConversacion(
  organizationId: string,
  identity: string,
  anuncio: AnuncioDeOrigen,
  reintentar = true
): Promise<void> {
  const intentos = reintentar ? INTENTOS : 1;
  for (let i = 0; i < intentos; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, ESPERA_MS));
    if (await atar(organizationId, identity, anuncio)) return;
  }
}

/** Un intento. `true` si quedó atado. */
async function atar(
  organizationId: string,
  identity: string,
  anuncio: AnuncioDeOrigen
): Promise<boolean> {
  const contacto = await findContactByIdentity(organizationId, identity);
  if (!contacto) return false; // el primer mensaje todavía no entró

  const db = getDb();
  const [conv] = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.contactId, contacto.id),
        eq(schema.conversation.channel, "whatsapp")
      )
    )
    .orderBy(desc(schema.conversation.createdAt))
    .limit(1);
  if (!conv) return false;

  await registrarAnuncioDeOrigen({
    organizationId,
    contactId: contacto.id,
    conversationId: conv.id,
    anuncio,
  });
  return true;
}
