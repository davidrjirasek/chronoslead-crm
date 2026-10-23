import { after } from "next/server";
import { getEnv } from "@/lib/env";
import {
  isValidSignature,
  registrarFirmaRechazada,
  isValidWebhookToken,
  type WebhookPayload,
} from "@/server/inbox/webhook";
import { processEchoesValue, processMessagesValue } from "@/server/inbox/ingest";
import type { Procedencia } from "@/server/inbox/procedencia";
import { processTemplateStatusValue } from "@/server/whatsapp/template-events";
import { isCloud } from "@/server/tenant/edition";

/** Esta puerta solo existe sin EDITION=cloud, donde hay una sola organización. */
const PROCEDENCIA_LEGACY: Procedencia = { via: "legacy" };

/**
 * Webhook público de WhatsApp (contrato webhook.md).
 * Capa 1: el segmento [webhookToken] debe coincidir (si no → 404 sin efectos).
 * Capa 2: firma x-hub-signature-256 solo si META_APP_SECRET está configurado.
 * El POST siempre responde 200 tras validar; el procesamiento va en after().
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ webhookToken: string }> };

export async function GET(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const env = getEnv();
  // 102 — En plataforma esta puerta compartida no existe: cada organización
  // tiene la suya en /api/webhooks/wa/{organizationId}/{firma}. No se borra
  // porque es el camino de upstream y con EDITION apagada sigue siendo el bueno.
  if (isCloud()) return new Response(null, { status: 404 });
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response(null, { status: 403 });
}

export async function POST(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const env = getEnv();
  // 102 — En plataforma esta puerta compartida no existe: cada organización
  // tiene la suya en /api/webhooks/wa/{organizationId}/{firma}. No se borra
  // porque es el camino de upstream y con EDITION apagada sigue siendo el bueno.
  if (isCloud()) return new Response(null, { status: 404 });
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!isValidSignature(rawBody, signature, env.META_APP_SECRET)) {
    registrarFirmaRechazada("wa", signature);
    return new Response(null, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    // body ilegible: 200 igualmente (Meta reintenta y termina desactivando)
    return Response.json({ received: true });
  }

  after(async () => {
    try {
      await processPayload(payload);
    } catch (err) {
      console.error("[webhook] error procesando payload:", err);
    }
  });

  return Response.json({ received: true });
}

async function processPayload(payload: WebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue;
      if (change.field === "messages") {
        await processMessagesValue(change.value, PROCEDENCIA_LEGACY);
      } else if (change.field === "smb_message_echoes") {
        // 008: mensajes enviados a mano desde la app del teléfono (coexistence)
        await processEchoesValue(change.value, PROCEDENCIA_LEGACY);
      } else if (change.field === "message_template_status_update") {
        await processTemplateStatusValue(entry.id ?? null, change.value);
      }
      // otros fields: ignorar sin error
    }
  }
}
