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
import { zernioSignatureFrom } from "@/server/zernio";
import {
  isAuthenticZernioDelivery,
  processZernioPayload,
} from "@/server/zernio/dispatch";

/** Esta puerta solo existe sin EDITION=cloud, donde hay una sola organización. */
const PROCEDENCIA_LEGACY: Procedencia = { via: "legacy" };

/**
 * Webhook público de WhatsApp (contrato webhook.md).
 * Capa 1: el segmento [webhookToken] debe coincidir (si no → 404 sin efectos).
 * Capa 2: firma x-hub-signature-256 solo si META_APP_SECRET está configurado.
 * El POST siempre responde 200 tras validar; el procesamiento va en after().
 *
 * 139 — Acepta las DOS fuentes por la misma URL, como ya hacen las rutas de
 * Instagram y Messenger, porque sus payloads son inconfundibles: Meta manda
 * `object: "whatsapp_business_account"` y Zernio un evento plano con
 * `account`.
 *
 * Y por eso el 404 de plataforma dejó de ser de toda la ruta y pasó a ser
 * solo del camino de Meta: esa puerta compartida es insegura en multitenant
 * —cualquier organización entraría por ella con el `phone_number_id` del
 * vecino, y por eso en cloud cada una tiene la suya en
 * `/api/webhooks/wa/{organizationId}/{firma}`—, pero una entrega de Zernio no
 * tiene ese problema: se enruta por el id de la cuenta y su firma se valida
 * contra el secreto de la organización dueña de ESA cuenta.
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
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const rawBody = await req.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // body ilegible: 200 igualmente (Meta reintenta y termina desactivando)
    return Response.json({ received: true });
  }

  // Meta se identifica en el cuerpo; lo que no es de Meta viene de Zernio.
  const esDeMeta =
    typeof payload === "object" &&
    payload !== null &&
    (payload as { object?: string }).object === "whatsapp_business_account";

  if (esDeMeta) {
    // 102 — En plataforma esta puerta compartida no existe PARA META: cada
    // organización tiene la suya. No se borra porque es el camino de upstream
    // y con EDITION apagada sigue siendo el bueno.
    if (isCloud()) return new Response(null, { status: 404 });
    const signature = req.headers.get("x-hub-signature-256");
    if (!isValidSignature(rawBody, signature, env.META_APP_SECRET)) {
      registrarFirmaRechazada("wa", signature);
      return new Response(null, { status: 401 });
    }
  } else {
    // Zernio: la firma se valida contra los secretos de la organización dueña
    // de ESTA cuenta, que hay que resolver leyendo el cuerpo primero (023).
    // Sin esta capa, quien conozca la URL puede inyectar mensajes falsos y
    // hacer que el agente conteste de verdad, por WhatsApp, a quien él elija.
    if (
      !(await isAuthenticZernioDelivery(rawBody, zernioSignatureFrom(req.headers)))
    ) {
      return new Response(null, { status: 401 });
    }
  }

  // Zernio corta a los 5 segundos y reintenta: se acusa recibo YA y se procesa
  // fuera de la ruta.
  after(async () => {
    try {
      if (esDeMeta) {
        await processPayload(payload as WebhookPayload);
      } else {
        // Un evento de Zernio se reparte por plataforma: esa API entrega TODAS
        // las cuentas de la llave por un solo webhook, así que esta URL
        // también puede traer Instagram, Messenger o TikTok.
        await processZernioPayload(payload);
      }
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
