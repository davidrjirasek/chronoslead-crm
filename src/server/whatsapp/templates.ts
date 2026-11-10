import { and, eq } from "drizzle-orm";
import {
  countVariables,
  renderBody,
  validateBodyVariables,
} from "@/lib/templates";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { graphRequest, MetaApiError, normalizeRecipient } from "@/lib/meta/client";
import { destinatarioMeta } from "@/lib/meta/destinatario";
import { scoped } from "@/lib/db/tenant";
import { publish } from "@/server/events/bus";
import {
  getCredentialsByOrg,
  getCredentialsByWabaId,
  getZernioWhatsappByOrg,
  markReconnectRequired,
  type Credentials,
  type ZernioWhatsapp,
} from "@/server/whatsapp/credentials";
import {
  createZernioTemplate,
  cuerpoDeComponentes,
  listZernioTemplates,
  sendZernioTemplate,
} from "@/server/whatsapp/zernio-templates";
import { callGraphSend, SendError } from "@/server/inbox/send";
import { serializeMessage } from "@/server/inbox/ingest";
import type { WebhookValue } from "@/server/inbox/webhook";

/** Errores tipados del servicio de plantillas → HTTP en la capa de API. */
export class TemplateError extends Error {
  code:
    | "not_connected"
    | "reconnect_required"
    | "invalid"
    | "not_found"
    | "meta_error"
    | "meta_unavailable";

  constructor(code: TemplateError["code"], message: string) {
    super(message);
    this.name = "TemplateError";
    this.code = code;
  }
}

const TEMPLATE_ERROR_STATUS: Record<TemplateError["code"], number> = {
  not_connected: 409,
  reconnect_required: 409,
  invalid: 422,
  not_found: 404,
  meta_error: 422,
  meta_unavailable: 503,
};

export function templateErrorStatus(err: TemplateError): number {
  return TEMPLATE_ERROR_STATUS[err.code];
}

export { countVariables, renderBody, validateBodyVariables };

type TemplateRow = typeof schema.template.$inferSelect;

export function serializeTemplate(t: TemplateRow) {
  return {
    id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    body: t.body,
    status: t.status,
    rejectionReason: t.rejectionReason,
  };
}

/** Crea la plantilla y la manda a aprobación de Meta (FR-050). */
export async function createTemplate(
  organizationId: string,
  input: {
    name: string;
    language: string;
    category: string;
    body: string;
    /** Un ejemplo por variable, en orden; es lo que ve quien revisa en Meta. */
    examples?: string[];
  }
): Promise<TemplateRow> {
  const variableError = validateBodyVariables(input.body);
  if (variableError) throw new TemplateError("invalid", variableError);

  // 142: el transporte decide a quién se le pide la plantilla. `meta` gana si
  // existe; si no, la conexión por Zernio. Un `null` en los dos es «esta
  // organización todavía no conectó WhatsApp».
  const transporte = await transporteDePlantillas(organizationId);
  if (transporte.tipo === "ninguno") {
    throw new TemplateError("not_connected", "Conecta tu número de WhatsApp primero");
  }
  if (transporte.status === "reconnect_required") {
    throw new TemplateError("reconnect_required", "Reconecta tu número antes de crear plantillas");
  }

  const name = input.name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (!name) throw new TemplateError("invalid", "Nombre de plantilla inválido");

  // Meta pide un ejemplo por variable: si faltan, rechaza la plantilla. Uno
  // realista («Ana», «martes 14») ayuda a que la aprueben; si el dueño no
  // escribió alguno, va el genérico.
  const variableCount = countVariables(input.body);
  const examples = Array.from(
    { length: variableCount },
    (_, i) => input.examples?.[i]?.trim() || `ejemplo ${i + 1}`
  );
  let waTemplateId: string | null = null;
  if (transporte.tipo === "zernio") {
    try {
      const res = await createZernioTemplate({
        credentials: transporte.zernio,
        name,
        language: input.language,
        category: input.category,
        body: input.body,
        examples,
      });
      waTemplateId = res.waTemplateId;
    } catch (err) {
      throw errorDePlantilla(err, organizationId);
    }
    return guardarPlantilla({
      organizationId,
      name,
      input,
      waTemplateId,
    });
  }

  const creds = transporte.meta;
  try {
    const res = await graphRequest<{ id?: string; status?: string }>(
      `${creds.wabaId}/message_templates`,
      {
        method: "POST",
        token: creds.token,
        body: {
          name,
          language: input.language,
          category: input.category,
          components: [
            {
              type: "BODY",
              text: input.body,
              ...(variableCount > 0
                ? { example: { body_text: [examples] } }
                : {}),
            },
          ],
        },
      }
    );
    waTemplateId = res.id ?? null;
  } catch (err) {
    throw errorDePlantilla(err, organizationId);
  }

  return guardarPlantilla({ organizationId, name, input, waTemplateId });
}

/**
 * 142 — Qué transporte sirve las plantillas de esta organización.
 *
 * `getCredentialsByOrg` devuelve null para una fila de Zernio a propósito
 * (139), así que el único sitio donde las dos formas conviven es este.
 */
type TransporteDePlantillas =
  | { tipo: "meta"; meta: Credentials; zernio: null; status: Credentials["status"] }
  | { tipo: "zernio"; meta: null; zernio: ZernioWhatsapp; status: ZernioWhatsapp["status"] }
  | { tipo: "ninguno"; meta: null; zernio: null; status: null };

async function transporteDePlantillas(
  organizationId: string
): Promise<TransporteDePlantillas> {
  const meta = await getCredentialsByOrg(organizationId);
  if (meta) return { tipo: "meta", meta, zernio: null, status: meta.status };
  const zernio = await getZernioWhatsappByOrg(organizationId);
  if (zernio) {
    return { tipo: "zernio", meta: null, zernio, status: zernio.status };
  }
  return { tipo: "ninguno", meta: null, zernio: null, status: null };
}

/**
 * Traduce un fallo del proveedor al error tipado del servicio. Vale para los
 * dos transportes porque `zernioFetch` ya devuelve `MetaApiError`.
 */
function errorDePlantilla(err: unknown, organizationId: string): unknown {
  if (err instanceof MetaApiError) {
    if (err.isAuthError) {
      void markReconnectRequired(organizationId);
      return new TemplateError(
        "reconnect_required",
        "El token expiró: reconecta el número"
      );
    }
    if (err.status === 0 || err.status >= 500) {
      return new TemplateError("meta_unavailable", "Meta no está disponible ahora");
    }
    return new TemplateError("meta_error", err.message);
  }
  return err;
}

/** El alta local, idéntica venga de donde venga la plantilla. */
async function guardarPlantilla(opts: {
  organizationId: string;
  name: string;
  input: { language: string; category: string; body: string };
  waTemplateId: string | null;
}): Promise<TemplateRow> {
  const db = getDb();
  const inserted = await db
    .insert(schema.template)
    .values({
      id: newId("template"),
      organizationId: opts.organizationId,
      name: opts.name,
      language: opts.input.language,
      category: opts.input.category,
      body: opts.input.body,
      status: "pending",
      waTemplateId: opts.waTemplateId,
    })
    .onConflictDoUpdate({
      target: [
        schema.template.organizationId,
        schema.template.name,
        schema.template.language,
      ],
      set: {
        category: opts.input.category,
        body: opts.input.body,
        status: "pending",
        rejectionReason: null,
        waTemplateId: opts.waTemplateId,
        updatedAt: new Date(),
      },
    })
    .returning();
  return inserted[0]!;
}

function mapMetaStatus(
  status: string | undefined
): TemplateRow["status"] | null {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";
  if (s === "PENDING" || s === "IN_APPEAL" || s === "PENDING_DELETION") {
    return "pending";
  }
  return null;
}

/**
 * Sincroniza estados desde Graph (`GET {waba}/message_templates`). Cubre el
 * modo agencia: los webhooks de plantillas NO siguen el override de callback,
 * así que el pull es la vía universal (DV-VC-04/DV-VC-15).
 */
export async function syncTemplates(organizationId: string): Promise<number> {
  const transporte = await transporteDePlantillas(organizationId);
  if (transporte.tipo === "ninguno") {
    throw new TemplateError("not_connected", "Conecta tu número de WhatsApp primero");
  }

  let data: {
    data?: { id?: string; name?: string; language?: string; status?: string; category?: string; quality_score?: unknown; rejected_reason?: string; components?: unknown }[];
  };
  try {
    if (transporte.tipo === "zernio") {
      // 142: Zernio lee la misma WABA por detrás, así que lo único que cambia
      // es la forma de la respuesta. Se adapta a la de Graph y el resto de
      // esta función no se entera de qué transporte la trajo.
      const remotas = await listZernioTemplates(transporte.zernio);
      data = {
        data: remotas.map((t) => ({
          id: t.id ?? undefined,
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category ?? undefined,
          rejected_reason: t.rejectedReason ?? undefined,
          // El cuerpo viaja ya extraído: Zernio lo entrega en componentes,
          // igual que Graph, y la importación de abajo lo necesita.
          components: t.body ? [{ type: "BODY", text: t.body }] : undefined,
        })),
      };
    } else {
      data = await graphRequest(`${transporte.meta.wabaId}/message_templates`, {
        token: transporte.meta.token,
      });
    }
  } catch (err) {
    if (err instanceof MetaApiError) {
      if (err.isAuthError) {
        await markReconnectRequired(organizationId);
        throw new TemplateError("reconnect_required", "El token expiró: reconecta el número");
      }
      throw new TemplateError("meta_unavailable", "No se pudo consultar Meta");
    }
    throw err;
  }

  const db = getDb();
  const local = await db
    .select()
    .from(schema.template)
    .where(scoped(schema.template.organizationId, organizationId));

  let updated = 0;
  for (const remote of data.data ?? []) {
    const status = mapMetaStatus(remote.status);
    if (!status) continue;
    const match = local.find(
      (t) =>
        (remote.id && t.waTemplateId === remote.id) ||
        (t.name === remote.name && t.language === remote.language)
    );
    if (!match) {
      // 142 — IMPORTAR lo que existe allá y no acá.
      //
      // Antes esto era `continue`, y la consecuencia se vio desplegando: las
      // plantillas creadas fuera del producto —por la API de Zernio, o a mano
      // en Meta Business Manager— nunca llegaban a la tabla local, y como el
      // envío busca por nombre EN LA TABLA, el aviso quedaba mudo con las
      // plantillas aprobadas a la vista en Meta.
      //
      // Sin cuerpo no se importa: una fila sin `body` no se puede enviar
      // (`countVariables` no sabría cuántos valores pedir) y sería peor que
      // no tenerla.
      const cuerpo = cuerpoDeComponentes(remote.components);
      if (!cuerpo || !remote.name || !remote.language) continue;
      await db.insert(schema.template).values({
        id: newId("template"),
        organizationId,
        name: remote.name,
        language: remote.language,
        category: remote.category ?? "UTILITY",
        body: cuerpo,
        status,
        rejectionReason: remote.rejected_reason ?? null,
        waTemplateId: remote.id ?? null,
      });
      updated += 1;
      continue;
    }
    // Meta reclasifica la categoría al aprobar (una UTILITY puede volverse
    // MARKETING, lo que cambia el costo por conversación): es autoridad.
    const category = remote.category ?? match.category;
    if (match.status === status && match.category === category) continue;
    await db
      .update(schema.template)
      .set({
        status,
        category,
        rejectionReason: remote.rejected_reason ?? null,
        waTemplateId: match.waTemplateId ?? remote.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.template.id, match.id));
    updated += 1;
  }
  return updated;
}

/** Evento webhook `message_template_status_update` (modo directo, FR-050). */
export async function applyTemplateStatusEvent(
  wabaId: string | null,
  value: WebhookValue
): Promise<void> {
  if (!wabaId) return;
  const creds = await getCredentialsByWabaId(wabaId);
  if (!creds) return;

  const status = mapMetaStatus(value.event);
  const name = value.message_template_name;
  const language = value.message_template_language;
  if (!status || !name || !language) return;

  const db = getDb();
  await db
    .update(schema.template)
    .set({
      status,
      rejectionReason: status === "rejected" ? (value.reason ?? null) : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.template.organizationId, creds.organizationId),
        eq(schema.template.name, name),
        eq(schema.template.language, language)
      )
    );
}

/** Envía una plantilla APROBADA a una conversación (ventana cerrada, FR-051). */
export async function sendTemplate(input: {
  organizationId: string;
  conversationId: string;
  templateId: string;
  variables?: string[];
}): Promise<{ messageId: string }> {
  const db = getDb();

  const templates = await db
    .select()
    .from(schema.template)
    .where(
      scoped(
        schema.template.organizationId,
        input.organizationId,
        eq(schema.template.id, input.templateId)
      )
    )
    .limit(1);
  const template = templates[0];
  if (!template) throw new TemplateError("not_found", "Plantilla no encontrada");
  if (template.status !== "approved") {
    throw new TemplateError("invalid", "Solo se pueden enviar plantillas aprobadas");
  }
  // Meta exige EXACTAMENTE un parámetro por variable del cuerpo: si sobran o
  // falta alguno responde 132000 (plantilla y parámetros no coinciden).
  const variableCount = countVariables(template.body);
  const values = (input.variables ?? [])
    .slice(0, variableCount)
    .map((v) => v.trim());
  if (values.length < variableCount || values.some((v) => !v)) {
    const missing = values.findIndex((v) => !v);
    const n = missing === -1 ? values.length + 1 : missing + 1;
    throw new TemplateError(
      "invalid",
      variableCount === 1
        ? "La plantilla requiere el valor de {{1}}"
        : `La plantilla requiere ${variableCount} valores: falta {{${n}}}`
    );
  }

  const rows = await db
    .select({ conversation: schema.conversation, contact: schema.contact })
    .from(schema.conversation)
    .innerJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id)
    )
    .where(
      scoped(
        schema.conversation.organizationId,
        input.organizationId,
        eq(schema.conversation.id, input.conversationId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new TemplateError("not_found", "Conversación no encontrada");
  if (row.conversation.isTest) {
    // Aserción dura del sandbox (FR-031)
    throw new SendError(
      "sandbox_violation",
      "Conversación de prueba del Laboratorio: el envío real está prohibido"
    );
  }

  const transporte = await transporteDePlantillas(input.organizationId);
  if (transporte.tipo === "ninguno") {
    throw new TemplateError("not_connected", "Sin número conectado");
  }
  if (transporte.status === "reconnect_required") {
    throw new TemplateError("reconnect_required", "Reconecta el número");
  }

  // 142: por Zernio, mandar la plantilla ES abrir la conversación. Por eso
  // este camino alcanza a un número con el que nunca se habló — que es justo
  // lo que necesita el aviso al equipo— mientras que el envío de texto
  // (`zernio-send.ts`) exige un hilo que ya exista.
  if (transporte.tipo === "zernio") {
    if (!row.contact.phone) {
      throw new TemplateError(
        "meta_error",
        "El contacto no tiene teléfono: por Zernio la plantilla se envía al número"
      );
    }
    let enviado: Awaited<ReturnType<typeof sendZernioTemplate>>;
    try {
      enviado = await sendZernioTemplate({
        credentials: transporte.zernio,
        toPhone: row.contact.phone,
        templateName: template.name,
        templateLanguage: template.language,
        params: values,
      });
    } catch (err) {
      throw errorDePlantilla(err, input.organizationId);
    }
    // El hilo que devuelve Zernio es la referencia con la que entrará la
    // respuesta: sin guardarla, la contestación abriría una conversación
    // paralela.
    if (enviado.conversationId && !row.conversation.channelThreadRef) {
      await db
        .update(schema.conversation)
        .set({ channelThreadRef: enviado.conversationId })
        .where(eq(schema.conversation.id, input.conversationId));
    }
    return registrarPlantillaEnviada({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      waMessageId: enviado.platformMessageId,
      texto: renderBody(template.body, values),
    });
  }

  const creds = transporte.meta;

  // 003: destinatario = teléfono normalizado o BSUID.
  // 003: teléfono en `to`, BSUID en `recipient` — Meta los pide en campos
  // distintos y mandar el BSUID en `to` devuelve 131026.
  const destinatario = destinatarioMeta(
    row.contact.phone ? normalizeRecipient(row.contact.phone) : null,
    row.contact.waUserId
  );
  if (!destinatario) {
    throw new TemplateError(
      "meta_error",
      "El contacto no tiene teléfono ni identidad de WhatsApp utilizable"
    );
  }

  const waMessageId = await callGraphSend(creds, {
    messaging_product: "whatsapp",
    ...destinatario,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(variableCount > 0
        ? {
            components: [
              {
                type: "body",
                parameters: values.map((text) => ({ type: "text", text })),
              },
            ],
          }
        : {}),
    },
  });

  return registrarPlantillaEnviada({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    waMessageId,
    texto: renderBody(template.body, values),
  });
}

/**
 * 142 — El rastro local de una plantilla que salió: el mensaje en la bandeja,
 * la conversación tocada y el evento por SSE. Es idéntico en los dos
 * transportes, y es lo que hace que un aviso se pueda MIRAR después —el
 * motivo por el que el destinatario del aviso es un contacto más del CRM.
 */
async function registrarPlantillaEnviada(opts: {
  organizationId: string;
  conversationId: string;
  waMessageId: string;
  texto: string;
}): Promise<{ messageId: string }> {
  const db = getDb();
  const inserted = await db
    .insert(schema.message)
    .values({
      id: newId("message"),
      organizationId: opts.organizationId,
      conversationId: opts.conversationId,
      waMessageId: opts.waMessageId,
      direction: "out",
      type: "template",
      text: opts.texto,
      status: "pending",
      origin: "template",
    })
    .returning();
  const message = inserted[0]!;

  await db
    .update(schema.conversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.conversation.id, opts.conversationId));

  publish(opts.organizationId, {
    type: "message.new",
    data: {
      conversationId: opts.conversationId,
      message: serializeMessage(message),
    },
  });

  return { messageId: message.id };
}
