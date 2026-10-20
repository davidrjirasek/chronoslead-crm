# 102 — Tareas

- [x] `src/lib/db/schema.ts` + `drizzle/0021_webhook_token_version.sql` —
      `organization.webhook_token_version`, aditiva con default 1.
- [x] `src/server/whatsapp/webhook-segment.ts` — derivación HMAC y validación en tiempo
      constante.
- [x] `src/server/inbox/procedencia.ts` — el tipo y `puedeEscribirEn`.
- [x] `src/server/inbox/ingest.ts` — procedencia **obligatoria** en
      `processMessagesValue` y `processEchoesValue`, con el descarte registrado sin datos
      personales.
- [x] `src/app/api/webhooks/wa/[webhookToken]/[firma]/route.ts` — la puerta por organización.
- [x] `src/app/api/webhooks/wa/[webhookToken]/route.ts` — 404 con `EDITION=cloud`; intacta sin
      ella, declarando procedencia `legacy`.
- [x] `src/server/whatsapp/webhook-url.ts` — `webhookDeSesion()`, puerta única para saber qué
      URL le toca a una organización en cualquier edición.
- [x] `src/app/api/settings/whatsapp/route.ts` y `src/app/api/settings/webhook/route.ts` — la
      pantalla y el registro automático en Meta usan la URL de la organización.
- [x] `tests/unit/webhook-por-organizacion.test.ts` — 14 casos.

## Verificación en vivo (2026-10-20)

Dos organizaciones: `alfa` (Ferretería El Martillo, con un número conectado) y `beta`
(Clínica Beta). `META_APP_SECRET` sin definir, como en la instancia local.

| Comprobación | Resultado |
|---|---|
| **Ataque**: entrar por la puerta de `beta` con el `phone_number_id` de `alfa` | 200 a Meta, **35 → 35 mensajes en alfa**: no entró nada |
| Legítimo: puerta de `alfa` con el `phone_number_id` de `alfa` | 35 → 36 mensajes: entró |
| Puerta de `alfa` con la firma de `beta` | 404 |
| Organización inventada | 404 |
| Puerta compartida vieja con `EDITION=cloud` | 404 |
| Handshake `GET` de `alfa` y de `beta` con su propia firma | 200 las dos |
| Tras subir `webhook_token_version` de `alfa` a 2 | URL vieja de alfa 404 · URL nueva 200 · **beta intacta, 200** |
| Con `EDITION` apagada, puerta compartida en `localhost` | 200 — como el Vocero original |

El conteo de mensajes se leyó de la base, no del código de respuesta: lo que importa es que
no se creara nada, no que la petición respondiera.

Gates: typecheck ✓ · lint ✓ · **1181 tests** ✓ · build ✓ (las dos rutas de webhook
convivien).

## Pendiente de verificación humana

- **Un webhook real de Meta** contra la URL por organización, con `META_APP_SECRET` puesto.
  Local no puede: Meta exige `https` y una URL pública. Entra en la fase de despliegue.
- Los webhooks de Instagram, Messenger y TikTok siguen con la puerta compartida: viven tras
  `CHANNELS`, hoy apagado.
