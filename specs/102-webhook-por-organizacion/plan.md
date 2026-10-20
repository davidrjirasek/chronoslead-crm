# 102 — Plan

## Constitution Check

| Principio | Cómo lo cumple |
|---|---|
| I · Seguridad de datos | Cierra una escritura cruzada entre organizaciones que no necesitaba credenciales de nadie. |
| III · Multi-tenancy real | «Cada organización tiene su URL firmada; la ingesta comprueba que la organización del cuerpo es la de la puerta.» |
| IV · Idempotencia | Sin cambios: `wa_message_id` UNIQUE sigue evitando el duplicado del reintento de Meta. |
| Governance · fork delgado | La ruta de upstream no se toca salvo un `if (isCloud()) → 404`; la migración es aditiva. |

## Las tres capas

1. **Segmento firmado** — `src/server/whatsapp/webhook-segment.ts`. Derivado, no guardado:
   `HMAC-SHA256(ENCRYPTION_KEY, "chronoslead:webhook:v1:{orgId}:{version}")`. Dice **a qué
   organización** va el evento.
2. **Firma de Meta** — `isValidSignature`, sin cambios. Dice **que viene de Meta**.
3. **Guardián de procedencia** — `src/server/inbox/procedencia.ts`, aplicado dentro de la
   ingesta. Dice **que la puerta y el cuerpo coinciden**.

La tercera es la que no se puede omitir: sin ella las dos primeras son decorativas, porque
cada cliente entraría por su propia puerta escribiendo el identificador del vecino.

## Por qué el parámetro es obligatorio

`processMessagesValue` y `processEchoesValue` reciben la procedencia como parámetro
**requerido**, no opcional con valor por defecto. Un camino nuevo que olvide declararla no
compila. Era viable porque solo había un llamador.

## La clave maestra

Se reutiliza `ENCRYPTION_KEY` (32 bytes, ya obligatoria y validada) en vez de añadir una
variable nueva. La etiqueta de dominio `chronoslead:webhook:v1` impide que este HMAC valga en
ningún otro contexto derivado de la misma clave.

## Nombre del segmento de ruta

Next.js exige que las rutas hermanas de un nivel usen el mismo nombre de parámetro. La puerta
nueva vive en `[webhookToken]/[firma]/` y el primer segmento **es** el `organizationId`; se
renombra al desestructurar. Renombrar la carpeta de upstream habría sido un conflicto en cada
merge.

## Migración

`0021_webhook_token_version.sql` — una columna aditiva con default, re-ejecutable y sin
bloqueo de tabla relevante.
