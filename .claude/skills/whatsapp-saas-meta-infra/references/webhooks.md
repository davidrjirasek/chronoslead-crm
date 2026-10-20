# Webhooks de WhatsApp

## Las tres capas de suscripción

| Capa | Qué es | Cómo |
|---|---|---|
| 1. **App** | Tu app escucha el objeto `whatsapp_business_account` | Panel: *Casos de uso → Personalizar → Configuración* (URL de devolución de llamada + token de verificación + campos `messages`, `message_template_status_update`, `account_update`, y para Coexistence también `smb_message_echoes`, `history`, `smb_app_state_sync`). O por API: `POST /{app_id}/subscriptions` con el token de app `{app_id}\|{app_secret}` |
| 2. **WABA** | Una WABA concreta envía eventos a tu app | `POST /{waba_id}/subscribed_apps` con `subscribed_fields=messages`, usando el token de esa WABA |
| 3. **Override** | Esa WABA manda a una URL distinta, la de su tenant | `POST /{waba_id}/subscribed_apps` con `override_callback_uri` + `verify_token` |

Sin la capa 1, en Graph v26 la capa 2 puede responder `success: true` **sin conservar** la WABA, y el override falla con código 100 (observado en Vocero Cloud el 10-sep-2026).

```ts
// Capa 1 por API (una vez por app)
await fetch(`https://graph.facebook.com/${V}/${APP_ID}/subscriptions`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    access_token: `${APP_ID}|${APP_SECRET}`,
    object: "whatsapp_business_account",
    callback_url: urlGeneral,
    verify_token: tokenGeneral,
    fields: "messages,message_template_status_update,account_update,smb_message_echoes,history,smb_app_state_sync",
  }),
});
```

Los cuatro de Coexistence (`account_update`, `smb_message_echoes`, `history`, `smb_app_state_sync`) son lo que **activa** la pantalla que ofrece conectar la app WhatsApp Business: Meta los lista como paso 1 de esa guía. Suscríbelos aunque tu producto todavía no importe historial ni contactos; tu webhook solo tiene que aceptarlos sin romperse (devolver 200 y, si acaso, reenviarlos como tipo no soportado).

## ⚠️ La app debe estar publicada

El propio panel lo avisa: *"Las aplicaciones solo podrán recibir webhooks de prueba enviados desde el panel de la aplicación mientras esta no esté publicada. No se entregará ningún dato de producción… a menos que esta se haya publicado."* Publicar **no** requiere App Review y se puede hacer antes de enviarla. En la masterclass costó más de una hora de reintentos por no hacerlo.

## URL por tenant

Ejemplo: `https://tu-dominio.com/api/webhooks/wa/{tenantId}/{tokenAleatorio}`

- `verify_token` = el último segmento (aleatorio, ≥ 32 caracteres, rotable).
- El router resuelve el tenant **por la URL** y responde 404 a cualquier combinación inválida.
- La firma se valida con el App Secret. En multi-tenant con varias apps, con el App Secret de la app que conectó ese tenant.

## GET · handshake

```ts
export function verificarWebhook(url: URL, tokenEsperado: string): Response {
  const p = url.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === tokenEsperado) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}
```

## POST · firma y respuesta rápida

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function firmaValida(cuerpoCrudo: string, cabecera: string | null, appSecret: string): boolean {
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", appSecret).update(cuerpoCrudo, "utf8").digest();
  const recibido = Buffer.from(cabecera.slice(7), "hex");
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
// Lee el cuerpo CRUDO (req.text()) antes de parsear JSON; con el JSON re-serializado la firma no coincide.
// Responde 200 enseguida y procesa en segundo plano; si tardas, Meta reintenta y duplica.
```

## Qué llega (resumen)

```text
entry[].changes[].field = "messages"
  value.metadata.phone_number_id          -> a qué número (tenant) pertenece
  value.contacts[]  { profile.name, wa_id, ... }   -> puede traer BSUID en vez de teléfono
  value.messages[]  { id, from, timestamp, type, text|image|audio|... }
  value.statuses[]  { id, status: sent|delivered|read|failed, errors[] }
entry[].changes[].field = "message_template_status_update"
  value { event: APPROVED|REJECTED|..., message_template_id, message_template_name, reason }

# Solo con números en Coexistence (app WhatsApp Business):
entry[].changes[].field = "smb_message_echoes"
  value.metadata.phone_number_id
  value.message_echoes[] { from: <número del negocio>, to: <cliente>, id, timestamp, type, text|image|... }
    -> lo que el dueño contestó DESDE EL TELÉFONO. Guárdalo como saliente "manual" en la misma
       conversación y aparta a tu agente de esa conversación: si no, contesta encima del dueño.
entry[].changes[].field = "account_update"
  value { phone_number, event: "PARTNER_REMOVED", disconnection_info: { reason, initiated_by: USER|SYSTEM } }
    -> el cliente desconectó desde la app, cambió de número o lleva ~14 días sin abrirla:
       marca la conexión como «hay que reconectar» y pausa los envíos.
  value { event: "ACCOUNT_OFFBOARDED" }  -> igual, sin número (reinstaló en otro teléfono).
entry[].changes[].field = "history" | "smb_app_state_sync"
  -> historial de chats (hasta 180 días, por fases y trozos) y agenda del teléfono. Solo llegan si los
     pediste con /smb_app_data. Un solo webhook puede traer miles de mensajes: guarda primero, procesa después.
```

- **Idempotencia:** upsert por `messages[].id` / `statuses[].id`, porque Meta reintenta.
- **Estados:** `accepted` (respuesta del envío) ≠ `sent` ≠ `delivered`. La UI muestra el último estado **recibido**, nunca uno supuesto.
- **Medios:** descarga el binario con el token del tenant cuando llega el webhook (`GET /{media_id}` → URL temporal).

## Si "no llega nada": diagnóstico en orden

1. ¿La app está **publicada**? Si no, publícala.
2. ¿El handshake responde desde internet? (`curl "https://…/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=123"` → `123`)
3. `GET /{waba_id}/subscribed_apps` con el token del tenant: ¿aparece **tu** app? ¿el `override_callback_uri` es la URL de **ese** tenant?
4. ¿El campo `messages` está suscrito en la capa 1 y en la capa 2?
5. ¿El remitente es un número permitido del número de prueba?
6. ¿El despliegue nuevo está vivo? Revisa el commit en `/health` y fuerza la recarga (Ctrl+F5).
7. Si todo lo anterior está bien, revisa los logs de firma: un secreto equivocado da 401/403 silenciosos.
