import type { ZernioWhatsapp } from "@/server/whatsapp/credentials";
import { zernioFetch } from "@/server/zernio";

/**
 * 142 — Plantillas cuando el transporte es Zernio (coexistencia).
 *
 * El transporte nativo habla con la Graph API: crea la plantilla en
 * `{waba}/message_templates` y la envía con un `to` suelto. Zernio no expone
 * ni la WABA ni un token de Meta —su llave es suya—, así que ese camino no
 * existe aquí. Sí expone las tres operaciones equivalentes, y la diferencia
 * que importa es la tercera:
 *
 * - crear:   POST /whatsapp/templates
 * - listar:  GET  /whatsapp/templates?accountId=…
 * - enviar:  POST /inbox/conversations
 *
 * **Enviar una plantilla ES abrir la conversación.** Zernio es
 * conversation-centric: `POST /inbox/conversations` con el teléfono en
 * `participantId` crea el hilo o reutiliza el que ya exista, y devuelve su
 * `conversationId`. Por eso este módulo es el que desbloquea los avisos al
 * equipo: hasta ahora, por Zernio solo se sabía CONTESTAR dentro de un hilo
 * existente (`zernio-send.ts`), y a una persona a la que nunca se le escribió
 * no había forma de alcanzarla.
 *
 * Los errores salen como `MetaApiError` porque `zernioFetch` ya los traduce:
 * el resto del CRM —incluido `isAuthError`— no tiene que saber de Zernio.
 */

/** Una plantilla tal como la devuelve Zernio, ya normalizada. */
export type ZernioTemplate = {
  /** Id de Meta, el mismo que guarda `template.waTemplateId`. */
  id: string | null;
  name: string;
  language: string;
  /** Crudo de Meta: APPROVED, PENDING, REJECTED… lo mapea quien llama. */
  status: string;
  category: string | null;
  rejectedReason: string | null;
  /** El texto del componente BODY, que es lo único que este producto usa. */
  body: string | null;
};

/** Saca el texto del BODY de los componentes que devuelve Meta. */
export function cuerpoDeComponentes(componentes: unknown): string | null {
  if (!Array.isArray(componentes)) return null;
  for (const c of componentes) {
    const comp = c as { type?: unknown; text?: unknown };
    if (String(comp.type ?? "").toUpperCase() !== "BODY") continue;
    const texto = typeof comp.text === "string" ? comp.text : null;
    if (texto) return texto;
  }
  return null;
}

/** El teléfono va en dígitos, con país y sin `+`. */
function soloDigitos(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function createZernioTemplate(input: {
  credentials: ZernioWhatsapp;
  name: string;
  language: string;
  category: string;
  body: string;
  /** Un ejemplo por variable, en orden: es lo que ve quien revisa en Meta. */
  examples: string[];
}): Promise<{ waTemplateId: string | null; status: string }> {
  const res = (await zernioFetch("/whatsapp/templates", {
    method: "POST",
    token: input.credentials.token,
    body: {
      accountId: input.credentials.accountRef,
      name: input.name,
      category: input.category,
      language: input.language,
      components: [
        {
          type: "body",
          text: input.body,
          ...(input.examples.length > 0
            ? { example: { body_text: [input.examples] } }
            : {}),
        },
      ],
    },
  })) as { template?: { id?: string; status?: string } };

  return {
    waTemplateId: res.template?.id ? String(res.template.id) : null,
    status: res.template?.status ?? "PENDING",
  };
}

export async function listZernioTemplates(
  credentials: ZernioWhatsapp
): Promise<ZernioTemplate[]> {
  const res = (await zernioFetch(
    `/whatsapp/templates?accountId=${encodeURIComponent(credentials.accountRef)}`,
    { token: credentials.token }
  )) as {
    templates?: unknown;
    data?: { templates?: unknown };
  };

  // Zernio envuelve en `data` en unos endpoints y no en otros: se aceptan las
  // dos formas para que un cambio de envoltorio no deje la sincronización muda.
  const crudo = Array.isArray(res.templates)
    ? res.templates
    : Array.isArray(res.data?.templates)
      ? res.data.templates
      : [];

  return (crudo as Record<string, unknown>[])
    .map((t) => ({
      id: t.id != null ? String(t.id) : null,
      name: String(t.name ?? ""),
      language: String(t.language ?? ""),
      status: String(t.status ?? ""),
      category: t.category != null ? String(t.category) : null,
      body: cuerpoDeComponentes(t.components),
      rejectedReason:
        t.rejected_reason != null
          ? String(t.rejected_reason)
          : t.rejectedReason != null
            ? String(t.rejectedReason)
            : null,
    }))
    .filter((t) => t.name && t.language);
}

/**
 * Abre la conversación con una plantilla, o la reutiliza si ya existía.
 *
 * Devuelve también el `conversationId` porque es la referencia de hilo que la
 * ingesta guarda en `conversation.channelThreadRef`: sin ella, la respuesta
 * del destinatario no tendría dónde caer.
 */
export async function sendZernioTemplate(input: {
  credentials: ZernioWhatsapp;
  /** Teléfono del destinatario. Se normaliza a dígitos aquí. */
  toPhone: string;
  templateName: string;
  templateLanguage: string;
  /** Un valor por variable, en el orden en que aparecen. */
  params: string[];
}): Promise<{ platformMessageId: string; conversationId: string | null }> {
  const res = (await zernioFetch("/inbox/conversations", {
    method: "POST",
    token: input.credentials.token,
    body: {
      accountId: input.credentials.accountRef,
      participantId: soloDigitos(input.toPhone),
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      templateParams: input.params,
    },
  })) as {
    data?: { conversationId?: string; messageId?: string };
    conversationId?: string;
    messageId?: string;
  };

  const conversationId =
    res.data?.conversationId ?? res.conversationId ?? null;
  const messageId = res.data?.messageId ?? res.messageId ?? null;

  return {
    // Sin id propio el mensaje quedaría sin referencia: mismo criterio que
    // `sendZernioMessage`.
    platformMessageId: String(messageId ?? `zernio_tpl_${Date.now()}`),
    conversationId: conversationId ? String(conversationId) : null,
  };
}
