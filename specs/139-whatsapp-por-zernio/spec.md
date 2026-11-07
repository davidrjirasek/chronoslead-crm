# 139 — WhatsApp por Zernio (coexistencia sin ser Tech Provider)

**Feature Branch**: `139-whatsapp-por-zernio`

**Created**: 2026-11-07

**Status**: Implementada y **verificada en vivo** con el número real
(7-nov-2026). Depende de la
[017](../017-messenger/spec.md) (el patrón de dos transportes para un canal) y
de la [023](../023-cuentas-de-zernio/spec.md) (el enrutado por `accountId`).

**Input**: el dueño necesita conectar el número corporativo de ZA Climatización
(+595 972 213 571) a su instancia, **sin sacarlo de la app WhatsApp Business
del teléfono**, y ChronosLead todavía no es Tech Provider de Meta.

**Carril**: ciclo completo. Migración aditiva, un archivo de upstream
(`inbox/send.ts`), la ruta pública del webhook de WhatsApp y una superficie de
Ajustes.

## Problema

Para que un número que **ya se usa** en la app WhatsApp Business entre a la
Cloud API conservándose en el teléfono (**Coexistencia**) hace falta el
Embedded Signup de un **Tech Provider** de Meta. El trámite de ChronosLead está
en curso.

Lo que se probó y NO sirve:

| Intento | Por qué no |
|---|---|
| Reclamar el número desde el Business Manager del cliente | Lo deja en «Cuentas de mensajes». No crea la sesión de API: el número no aparece entre los de la Cloud API |
| Traer el Embedded Signup de upstream (spec 066) | Su propio encabezado dice «sin la coexistencia», y llama a `/{phone_number_id}/register` con PIN — que es justo lo que **saca el número del teléfono** |
| Usar el asistente manual con lo que da Zernio | Zernio **no entrega las credenciales de Meta**. Devuelve `accountId`, `profileId` y el número; el asistente pide `wabaId` + `phoneNumberId` + token |

Zernio **sí** es Tech Provider y **sí** hace Coexistencia (el dueño escanea un
QR y el número sigue en su teléfono). Lo que faltaba era el código: hasta esta
spec, `ZernioChannel` excluía WhatsApp **explícitamente**
(`Exclude<Channel, "whatsapp">`), y el envío de WhatsApp salía siempre directo
a la Graph API.

## Decisiones

### D1 · Dos transportes para UN canal, no un canal nuevo

WhatsApp por Zernio **no es un canal**: es el mismo canal con otro transporte.
Lo decide una columna, igual que en `messenger_credentials` desde la 017:

```
source: text("source", { enum: ["zernio", "meta"] }).notNull().default("meta")
```

El default es `meta`, así que **ninguna organización ya conectada cambia de
comportamiento**. El comentario de `tiktok_credentials` anticipaba esto: «`source`
existe, con un solo valor, para que una fuente futura no pida otra migración».

### D2 · El accesor nativo solo devuelve filas nativas

`wabaId` y `phoneNumberId` pasan a ser opcionales **en la tabla**, pero el tipo
`Credentials` los conserva obligatorios y `toCredentials()` descarta las filas
que no son del transporte nativo.

Por qué: 44 usos en 17 archivos leen esos dos campos para armar llamadas a la
Graph API. Hacerlos nulos en el tipo obligaba a tocar los 17 y a que cada sitio
aprendiera a dudar. Con el filtro en el conversor, el compilador señaló **un
solo** sitio que había que tocar (`doctor/checks.ts`, que lee la fila cruda), y
el camino de los clientes conectados quedó demostrablemente intacto.

Consecuencia que hay que respetar: `getCredentialsByOrg()` devuelve `null` para
una organización conectada por Zernio. Todo camino que antes interpretaba ese
`null` como «no hay número» tiene que consultar antes
`getZernioWhatsappByOrg()`. Hecho en `prepareSend` y en `GET /api/settings/whatsapp`.

### D3 · El eco vive una sola vez, y `source` decide qué es un eco

Lo que el dueño contesta desde el teléfono llega como `message.sent` con
`message.source`:

| `source` | Qué es | Qué hacemos |
|---|---|---|
| `whatsapp_business_app` | lo escribió el dueño en el teléfono | eco: guardar como `origin: "manual"` y **apartar al agente** |
| `meta_business_agent` | contestó el agente de Meta en ese número | ídem |
| `cloud_api` | **lo mandamos nosotros** por Zernio | ignorar |

Sin esa distinción, cada mensaje del CRM volvería como eco, se guardaría dos
veces **y pausaría al agente**: el agente se apagaría solo justo después de
contestar por primera vez.

El núcleo del eco (guardar + handoff `manual_reply`) ya existía para el
transporte nativo, privado dentro de `inbox/ingest.ts`. Se extrajo a
`ingestManualOutbound()` y lo comparten los dos. Duplicarlo habría significado
que el día que cambie la regla del handoff se arregle un transporte y no el
otro, con el peor síntoma posible: el agente contestándole encima al dueño.

### D4 · La identidad va sin el «+»

`sender.phoneNumber` llega en E.164 **con** «+»; `sender.id` sin él; el
transporte nativo guarda lo que manda Meta en `from`, que nunca lo lleva. Se
normaliza quitando el «+» y aplicando después `normalizeMx` (spec 003), para que
el **mismo** cliente sea el **mismo** contacto por los dos transportes. Sin
esto, el día que un número pase de un transporte al otro, el historial del
cliente se parte en dos fichas sin que nada falle a la vista.

### D5 · La puerta compartida de WhatsApp se abre, pero solo para Zernio

`/api/webhooks/wa/{verify token}` devolvía 404 con `EDITION=cloud`, porque esa
puerta es insegura en multitenant: cualquier organización entraría por ella con
el `phone_number_id` del vecino. Por eso en plataforma cada una tiene la suya en
`/api/webhooks/wa/{organizationId}/{firma}`.

Una entrega de Zernio no tiene ese problema: se enruta por el id de la cuenta y
su firma se valida contra el secreto de la organización dueña de **esa** cuenta.
Así que el 404 dejó de ser de toda la ruta y pasó a ser **solo del camino de
Meta**. Los payloads son inconfundibles: Meta manda
`object: "whatsapp_business_account"`.

### D6 · Lo que este transporte todavía NO hace

Se dice con un error que el operador entiende, nunca con un fallo silencioso ni
con un `TypeError` sobre `credentials!`:

- **Adjuntos**: Zernio los manda por URL pública y los nuestros viven en el
  volumen local. Hace falta exponerlos primero.
- **Ubicaciones y contactos**: existen en el payload `interactive` de Zernio; no
  están traídos.
- **Plantillas / mensajes iniciados por el negocio**: el envío usa
  `POST /inbox/conversations/{id}/messages`, que necesita una conversación ya
  abierta. Iniciar es `POST /inbox/conversations` con `participantId`.
- **Acuses de entrega**: `message.delivered` / `message.read` llegan y se
  ignoran, así que un saliente queda en `sent` y no avanza a «entregado».

## Lo que quedó tocado

| Archivo | Qué |
|---|---|
| `src/lib/db/schema.ts` + `drizzle/0032_*.sql` | `source`, `account_ref`, las tres columnas del secreto cifrado; `waba_id` y `phone_number_id` opcionales; único por `account_ref` |
| `src/server/whatsapp/credentials.ts` | el filtro del transporte nativo + el tipo `ZernioWhatsapp` y sus accesores |
| `src/server/whatsapp/zernio-ingest.ts` | **nuevo**: normalizadores puros de entrante y de eco |
| `src/server/whatsapp/zernio-send.ts` | **nuevo**: la frontera de salida |
| `src/server/inbox/ingest.ts` | `ingestManualOutbound()` extraído y compartido |
| `src/server/inbox/send.ts` | la rama de Zernio en `prepareSend` y en `sendText`; guardas en adjuntos y estructurados |
| `src/server/zernio/{cuentas,conexiones,dispatch,index}.ts` | WhatsApp deja de estar excluido; se enruta y se firma como los demás |
| `src/app/api/webhooks/wa/[webhookToken]/route.ts` | acepta las dos fuentes |
| `src/app/api/settings/whatsapp/route.ts` | `source` en el PUT, Zernio en el GET, DELETE sin override |
| `src/components/settings/whatsapp-wizard.tsx` | la tarjeta de conexión por Zernio y las consecuencias de la Coexistencia |
| `src/server/doctor/checks.ts` | la revisión del token es del transporte nativo |
| `tests/unit/whatsapp-por-zernio.test.ts` | **nuevo**: 14 casos sobre los normalizadores |

## Verificación

**Hecho:** `typecheck` + `lint` + `test` (127 archivos, 1423 casos) + `build`, y
el gate que manda: **`test:e2e:aislamiento` en 92/92**, con la **sección 15**
nueva que prueba este camino con UNA llave compartida entre dos clientes —el
caso de la agencia— porque con llave compartida el aislamiento no lo da ni la
puerta ni la firma, lo da el reparto por `accountId`.
Los 14 casos nuevos cubren la identidad sin «+», la simetría 521/52, el BSUID
como respaldo, el descarte de otras plataformas, y los tres valores de `source`
—incluido que `cloud_api` **no** es un eco, que es el fallo más caro de los
posibles.

**Verificado en vivo el 7-nov-2026** con +595 972 213 571: entra un mensaje,
sale una respuesta desde el CRM, y lo escrito **desde el teléfono** aparece
como saliente con la etiqueta «Celular», la conversación en «Atención humana» y
la IA en pausa con su motivo. Coexistencia completa.

**Status**: implementada y verificada en producción.
