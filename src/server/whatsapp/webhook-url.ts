import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { baseDomain, isCloud } from "@/server/tenant/edition";
import { segmentoDeOrganizacion } from "@/server/whatsapp/webhook-segment";

/**
 * Dónde recibe esta instancia los webhooks de Meta.
 *
 * La URL es fija: `APP_BASE_URL` + `/api/webhooks/<canal>/<verify token>`. El
 * verify token hace de segmento secreto de la ruta (capa 1 del webhook) y es
 * el mismo que Meta manda en el handshake, así que la URL se trata como una
 * contraseña y jamás se escribe entera en un log.
 *
 * Única puerta para construirla: la pantalla que la enseña, el registro
 * automático en Meta y el mock la toman de aquí, para que no haya dos formas
 * de armarla que un día dejen de coincidir.
 */
export type WebhookChannel = "wa" | "ig" | "messenger" | "tiktok";

/** Ruta (sin origen) del webhook de un canal. */
export function webhookPath(channel: WebhookChannel = "wa"): string {
  return `/api/webhooks/${channel}/${getEnv().META_WEBHOOK_VERIFY_TOKEN}`;
}

/** URL pública completa del webhook de un canal. */
export function webhookUrl(channel: WebhookChannel = "wa"): string {
  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  return `${base}${webhookPath(channel)}`;
}

/** El verify token que Meta debe mandar en el handshake de cualquier canal. */
export function webhookVerifyToken(): string {
  return getEnv().META_WEBHOOK_VERIFY_TOKEN;
}

/**
 * 102 — Lo que ve una organización en plataforma: SU puerta, sobre SU
 * subdominio. Enseñarle una URL del dominio base, o la compartida, parece un
 * error aunque el reparto funcione por el id de la ruta.
 *
 * El verify token del handshake es el mismo segmento: un solo valor que
 * copiar, y es el que la ruta ya comprueba.
 */
export type WebhookDeEntrada = {
  path: string;
  url: string;
  verifyToken: string;
};

/**
 * La ÚNICA puerta para saber qué webhook le corresponde a una organización,
 * en cualquier edición. La pantalla que la enseña, el registro automático en
 * Meta y el mock la toman de aquí, para que no haya dos formas de armarla que
 * un día dejen de coincidir.
 */
export async function webhookDeSesion(
  organizationId: string,
  channel: WebhookChannel = "wa"
): Promise<WebhookDeEntrada> {
  if (!isCloud()) {
    return {
      path: webhookPath(channel),
      url: webhookUrl(channel),
      verifyToken: webhookVerifyToken(),
    };
  }
  const db = getDb();
  const rows = await db
    .select({
      v: schema.organization.webhookTokenVersion,
      slug: schema.organization.slug,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const fila = rows[0];
  if (!fila) {
    // Una sesión sin organización no llega aquí (101 la rechaza antes). Si
    // llegara, mejor una URL que no vale que una que apunta a otra puerta.
    return { path: "", url: "", verifyToken: "" };
  }
  return webhookDeOrganizacion(organizationId, fila.v, fila.slug, channel);
}

export function webhookDeOrganizacion(
  organizationId: string,
  version: number,
  slug: string | null,
  channel: WebhookChannel = "wa"
): WebhookDeEntrada {
  const env = getEnv();
  const firma = segmentoDeOrganizacion(
    organizationId,
    version,
    env.ENCRYPTION_KEY
  );
  const path = `/api/webhooks/${channel}/${organizationId}/${firma}`;
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const origen =
    slug && baseDomain()
      ? base.replace(`//${baseDomain()}`, `//${slug}.${baseDomain()}`)
      : base;
  return { path, url: `${origen}${path}`, verifyToken: firma };
}
