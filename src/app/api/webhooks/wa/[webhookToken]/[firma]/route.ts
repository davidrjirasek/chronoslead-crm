import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isValidSignature, type WebhookPayload } from "@/server/inbox/webhook";
import { processEchoesValue, processMessagesValue } from "@/server/inbox/ingest";
import type { Procedencia } from "@/server/inbox/procedencia";
import { processTemplateStatusValue } from "@/server/whatsapp/template-events";
import { segmentoValido } from "@/server/whatsapp/webhook-segment";
import { isCloud } from "@/server/tenant/edition";

/**
 * 102 — Webhook de WhatsApp con una puerta por organización.
 *
 * `/api/webhooks/wa/{organizationId}/{firma}`
 *
 * Tres capas, y las tres hacen falta:
 *   1. La **firma del segmento** dice a qué organización va el evento (404 si no).
 *   2. La **firma de Meta** (`x-hub-signature-256`) dice que viene de Meta.
 *   3. El **guardián de procedencia**, ya dentro de la ingesta, impide que un
 *      cuerpo con el `phone_number_id` de otra organización escriba en ella.
 *
 * Sin la tercera, las dos primeras son decorativas: cualquier cliente entraría
 * por su propia puerta con el identificador del vecino.
 */
export const dynamic = "force-dynamic";

/**
 * El primer segmento ES el `organizationId`. Se llama `webhookToken` porque
 * Next.js exige que las rutas hermanas de un mismo nivel usen el mismo nombre
 * de parámetro, y la hermana es la puerta compartida de upstream
 * (`[webhookToken]/route.ts`), que no se renombra para no pelear en cada merge.
 */
type Params = { params: Promise<{ webhookToken: string; firma: string }> };

const NO_ENCONTRADO = new Response(null, { status: 404 });

/**
 * La versión vigente del segmento de esa organización, o null si no existe.
 * Subir `webhook_token_version` rota la URL de una sola organización.
 */
async function versionDe(organizationId: string): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ v: schema.organization.webhookTokenVersion })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  return rows[0]?.v ?? null;
}

async function puertaValida(
  organizationId: string,
  firma: string
): Promise<boolean> {
  // En edición de un solo negocio esta puerta no existe: la de siempre es
  // `/api/webhooks/wa/{verify token}`, que sigue intacta.
  if (!isCloud()) return false;
  const version = await versionDe(organizationId);
  if (version === null) return false;
  return segmentoValido(
    organizationId,
    version,
    getEnv().ENCRYPTION_KEY,
    firma
  );
}

export async function GET(req: Request, { params }: Params) {
  const { webhookToken: organizationId, firma } = await params;
  if (!(await puertaValida(organizationId, firma))) return NO_ENCONTRADO;

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // El verify token del handshake es el mismo segmento: es lo que el cliente
  // tiene a la vista y lo que esta ruta ya comprobó.
  if (mode === "subscribe" && token === firma) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response(null, { status: 403 });
}

export async function POST(req: Request, { params }: Params) {
  const { webhookToken: organizationId, firma } = await params;
  if (!(await puertaValida(organizationId, firma))) return NO_ENCONTRADO;

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!isValidSignature(rawBody, signature, getEnv().META_APP_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return Response.json({ received: true });
  }

  const procedencia: Procedencia = { via: "organizacion", organizationId };
  after(async () => {
    try {
      await procesarPayload(payload, procedencia);
    } catch (err) {
      console.error("[webhook] error procesando payload:", err);
    }
  });

  return Response.json({ received: true });
}

async function procesarPayload(
  payload: WebhookPayload,
  procedencia: Procedencia
): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue;
      if (change.field === "messages") {
        await processMessagesValue(change.value, procedencia);
      } else if (change.field === "smb_message_echoes") {
        await processEchoesValue(change.value, procedencia);
      } else if (change.field === "message_template_status_update") {
        await processTemplateStatusValue(entry.id ?? null, change.value);
      }
    }
  }
}
