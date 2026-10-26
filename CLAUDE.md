# ChronosLead — Guía para Claude

## Empezá leyendo esto, en este orden

Si llegás a este repo sin contexto —chat nuevo, otra máquina, otra persona—,
**estos tres archivos tienen todo lo que hace falta.** No hay conocimiento
importante que viva solo en una conversación: lo que no está acá, no existe.

| Archivo | Qué tiene |
|---|---|
| **este archivo** | Las reglas. Qué manda sobre qué, y las trampas que ya costaron tiempo |
| **[docs/bitacora.md](docs/bitacora.md)** | **Qué se hizo, cómo se probó y qué quedó pendiente.** El registro operativo real: dominios, decisiones del dueño, fallos encontrados en vivo y por qué se arreglaron así. **Al cerrar cada fase se le agrega: qué quedó, cómo se probó, qué sigue** |
| **[docs/alta-de-cliente.md](docs/alta-de-cliente.md)** | Cómo dar de alta un cliente, doce pasos con lista de control |

El estado de diseño durable vive en `specs/`; las decisiones de arquitectura,
en `docs/adr-*.md`.

> **Este repo es un fork de Vocero CRM convertido en SaaS multitenant.** Lo de abajo
> (desde «Lee primero AGENTS.md») es la guía original de Vocero y describe su código:
> sigue siendo válida. Lo de aquí arriba es lo que cambia por ser plataforma, y manda
> sobre ella cuando se contradigan.

ChronosLead es un SaaS multitenant: **una sola instancia sirve a muchas organizaciones**,
cada una en su subdominio `{slug}.chronoslead.com`, con sus propios canales, su propia
llave de IA y su propio agente. La landing pública vive en el apex `chronoslead.com`.

> **Lo primero que cambia respecto a una instancia de un solo negocio:**
> `select … from organization limit 1` ya no significa «mi organización»; es el cruce de
> datos entre clientes. La organización actual se resuelve SIEMPRE por el Host.
>
> **La ruta de resolución ya existe** (pasos 1 y 2 de la skill `saas-multitenant`,
> hechos): `resolveTenantFromHost()` en `src/lib/tenant/host.ts` convierte el Host en
> `{tenant, landing, admin, alta, desconocido}`, y `currentTenantOrg()` en
> `src/server/tenant/current.ts` es el que devuelve «esta organización». No queda
> deuda de `limit(1)` sobre `organization`.

## Qué falta del mapa (auditado 2026-10-22)

De los diez pasos de la skill `saas-multitenant`, **ocho están**. Faltan dos, y
uno de ellos tiene una trampa que muerde en cada alta:

| Paso | Estado |
|---|---|
| **6 · Embedded Signup** | **No está.** Cada cliente conecta WhatsApp a mano: comparte su WABA, y su token se pega en Ajustes → WhatsApp. El botón que lo hace solo necesita el estatus de Tech Provider de Meta — decisión del dueño: después |
| **7 · Alta automática** | **No se quiere.** El alta la hace el operador desde `admin.…` tras la reunión de diagnóstico. No es un agujero, es el modelo de negocio |
| **8 · Infra comodín** | **No está, y es la trampa.** El DNS sí es comodín (Cloudflare resuelve cualquier subdominio), pero **el proxy de Coolify tiene una lista de dominios escrita a mano**. Un subdominio que no esté en esa lista contesta `503 no available server` y NUNCA llega a la app: la pantalla «esta instancia no existe» no se ve jamás |

> **Por eso, dar de alta un cliente son DOS lugares, no uno:** el panel de
> superadmin **y** el campo Domains de Coolify. Si se olvida el segundo, el
> cliente queda perfecto en la base y su dirección no existe.
> Procedimiento completo: [docs/alta-de-cliente.md](docs/alta-de-cliente.md).

## Reglas (resumen de la constitución)

Ver `.specify/memory/constitution.md` — la de plataforma, que **reemplazó** la de Vocero
(«una instancia = un negocio»). Las que más se rompen sin querer:

- **Aislamiento**: `organization_id` NOT NULL en toda tabla de dominio; toda consulta pasa
  por `scoped()` (`src/lib/db/tenant.ts`). La organización sale del Host, nunca de «la
  única» ni de «la primera membresía».
- **Webhook**: cada organización tiene su URL firmada; la ingesta comprueba que la
  organización del cuerpo es la de la puerta. Ese guardián no es opcional.
- **Secretos**: cifrados en reposo (`src/lib/crypto/`); jamás al cliente ni a logs; solo
  últimos 4.
- **Idempotencia**: webhooks dedup por `wa_message_id` UNIQUE.
- **Persistencia**: suspender retira el servicio, nunca los datos.

Recetas: skill `saas-multitenant`. Conexión con Meta: skills `whatsapp-saas-meta-infra` y
`whatsapp-meta-app-review`.

## Fork delgado: banderas antes que borrar

`upstream` es `kevinrivm/vocero-crm` y se sigue trayendo. **Cada línea que borres es un
conflicto futuro.** Lo multitenant va detrás de `EDITION=cloud`: sin esa variable, el repo
se comporta como el Vocero original. No reconstruyas bandeja, pipeline, agenda, contactos
ni agente: ya existen y reinventarlos es justo el error que este fork corrige.

## Antes de escribir un procedimiento, buscá si ya existe

Este repo **viene con sus propias instrucciones**, y más de una está escrita
para que la siga una IA. Antes de redactar una guía, unos pasos o un documento
de proceso: buscalo primero. Siempre.

```bash
ls *.md docs/                      # qué documenta ya el repo
grep -ril "<el tema>" . --include=*.md --exclude-dir=node_modules
```

| Si vas a… | Leé PRIMERO |
|---|---|
| Desplegar (Coolify, compose, Render/Fly/Railway) | [`INSTALL-IA.md`](INSTALL-IA.md) — **es un guion escrito para la IA**. En ChronosLead: Ruta A, **variante «construir desde el código»** (es un fork). El delta de plataforma, en [docs/despliegue-coolify.md](docs/despliegue-coolify.md) |
| Levantar el entorno local | [docs/desarrollo-local.md](docs/desarrollo-local.md) |
| Actualizar de versión | `CHANGELOG.md` → «Actualizar desde…» |
| Entender una decisión de arquitectura | `docs/adr-*.md` |
| Tocar el código | [AGENTS.md](AGENTS.md) |

**Por qué está escrito aquí y no en una nota suelta:** ya ocurrió dos veces —
un logo redibujado existiendo el archivo, y una guía de despliegue redactada
a mano existiendo `INSTALL-IA.md`. Las dos se detectaron porque el dueño
preguntó. El dueño no es el mecanismo de control.

Un documento que *describe* algo no es ese algo ya hecho — pero un documento
que *instruye* cómo hacer algo manda sobre tu criterio. Distinguilos: el
primero es especificación, el segundo es procedimiento.

## Mapa de lo que toca la conversión

| Quieres cambiar… | Toca… |
|---|---|
| Qué organización es «esta» | `src/lib/tenant/host.ts` (Host → tenant) · `src/server/tenant/current.ts` (`currentTenantOrg()`) |
| El acceso a datos con tenant | `src/lib/db/tenant.ts` (`scoped()`) |
| Los webhooks públicos | `src/app/api/webhooks/{wa,ig,messenger,tiktok}/[webhookToken]/` |
| La plataforma (alta, suspensión, superadmin, pagos) | `src/app/admin/` + `src/components/admin/padron.tsx` · acciones en `src/app/admin/actions.ts` |
| El canal WhatsApp | `src/server/whatsapp/` |
| El agente / cerebro | `src/server/ai/`, `src/server/brains/` |
| Esquema y migraciones | `src/lib/db/schema.ts` → `pnpm db:generate` → `drizzle/` |

## Variables de entorno

Ver `.env.example`. Las propias del modo multitenant:

```bash
EDITION=cloud                   # sin ella corre como un solo negocio
BASE_DOMAIN=chronoslead.com     # lvh.me en local (resuelve a 127.0.0.1)
APP_BASE_URL=https://chronoslead.com
```

## Definición de Hecho REFORZADA

En esta Mac los comandos van por `corepack pnpm`, no `pnpm` a secas
(ver [docs/desarrollo-local.md](docs/desarrollo-local.md)):

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
```

Y el gate que manda, con dos organizaciones sembradas en `*.lvh.me` y la app viva:

```bash
corepack pnpm test:e2e:aislamiento    # 45 comprobaciones, spec 105
```

Necesita la app viva con `EDITION=cloud`, `BASE_DOMAIN=lvh.me`,
`WA_MOCK_ENABLED=true` y `BOT_API_KEY`. Siembra sus propias organizaciones.

> **La base de desarrollo YA EXISTE en la Mac del dueño** y el `.env` dice
> dónde: `127.0.0.1:**5433**`, base `vocero`. El binario vive en
> `~/.local/share/pgsql/bin` y los datos en `~/.local/share/chronoslead-pgdata`
> — **no** en Homebrew, **no** en `/Applications`, **no** en el 5432. Buscarlo
> donde «se suele instalar» da falso negativo; ya costó una descarga al pedo el
> 24-oct. Para saber si está corriendo: `lsof -nP -iTCP:5433 -sTCP:LISTEN`.
>
> **No lo corras tres veces seguidas.** El producto permite 10 inicios de
> sesión cada 10 minutos por IP; a la segunda o tercera corrida el guion choca
> con el 429 y avisa «esto NO es un fallo de aislamiento: no pude medir». Una
> corrida, y si hay que repetir, esperá los 10 minutos.

**El de aislamiento manda**: mientras no esté verde, nada está Hecho. Sus comprobaciones de
ESCRITURA (un evento por la puerta de A no entra en B) importan más que las de lectura.
Detalle en la skill `loop-sdd` (`references/contrato.md`).

«Hecho» significa probado en vivo. Lo que no se pueda probar se marca explícitamente
«pendiente de verificación humana».

## Manejo de credenciales

Credencial nueva → `.env` como `REEMPLAZA_…` con guía `#` → `.env.example` sin valor →
aviso en el chat. En Coolify las variables solo se inyectan en un *deploy*, no en un
restart. Nunca secretos en el chat, en argv ni en commits: solo los últimos 4.

## Modo Objetivo — Loop SDD

Cuando el dueño da una META: skill `loop-sdd`. Bitácora operativa (dominios, UUIDs, qué se
probó) en `docs/bitacora.md`, **sin secretos**.

---

# Vocero CRM — Guía para Claude (original del upstream)

Lee primero [AGENTS.md](AGENTS.md): el mapa del código y las reglas de
modificación viven ahí; este archivo solo añade lo específico de Claude Code.

Vocero es un CRM de WhatsApp open source (MIT), self-hosted, con agente de IA y
Laboratorio de auto-evaluación. Una instancia = un negocio. Este archivo guía a
Claude Code (u otro asistente) para operar y **modificar** este repositorio —
el caso típico: una agencia adaptando Vocero para un cliente.

## Stack

**Next.js 15 (App Router) + React 19** en monolito · TypeScript estricto
(`strict` + `noUncheckedIndexedAccess`) · Tailwind CSS (sistema de diseño de la
marca Vocero, el mismo de vocerocrm.com: tokens en `src/app/globals.css`, tema
claro/oscuro, acento white-label por defecto `#0d5bff`, fuentes Archivo +
Instrument Serif + IBM Plex Mono self-hosted vía `next/font`; el logo vive en
`src/lib/brand.ts` y se dibuja con `src/components/brand-mark.tsx`) ·
**PostgreSQL + Drizzle ORM** (migraciones versionadas en
`drizzle/`, aplicadas al ARRANCAR el contenedor) · **Better Auth** + plugin
organization · **Zod** en todo input externo · nanoid con prefijos (`ct_`,
`cv_`, `msg_`…) · pnpm · Vitest (unit) + guiones E2E en `tests/e2e/`
conducidos con Playwright · Docker multi-stage (standalone, healthcheck
`/api/health`) · deploy en Coolify (Ruta A) o docker compose + Caddy (Ruta B).

Tiempo real por **SSE** (`/api/events`): heartbeat `: ping` ~25s, headers
anti-buffering, catch-up por refetch con `since=`. Sin WebSockets, sin colas
externas: el trabajo en segundo plano (agente, Laboratorio) es in-process.

## Mapa del código (fronteras de modificación)

| Quieres cambiar… | Toca… |
|---|---|
| El cerebro/proveedor LLM | `src/lib/ai/` (adaptador OpenRouter-compatible, `chatJson<T>`) |
| El comportamiento/prompt del agente | `src/server/ai/prompts.ts` |
| Las acciones que puede tomar el agente | `src/server/ai/actions.ts` + ejecución en `src/server/ai/pipeline.ts` |
| Las personas o el juez del Laboratorio | `src/server/lab/personas.ts` · `src/server/lab/judge.ts` |
| El canal WhatsApp (Graph API) | `src/lib/meta/` (cliente único) + `src/server/whatsapp/` |
| Los canales opcionales (Instagram, Messenger; ADR-001) | `src/lib/channels.ts` (catálogo) · `src/server/channels/` (capacidades y bandera `CHANNELS`) · `src/server/instagram/` · `src/server/messenger/` · `src/server/zernio/` (transporte y firma de la API unificada, compartido) |
| Campos/tablas | `src/lib/db/schema.ts` → `pnpm db:generate` → migración nueva en `drizzle/` |
| La ingesta/envío de mensajes | `src/server/inbox/` (ingest idempotente, send con guard de sandbox, ventana 24h) |
| Cómo se identifica a un contacto | `src/server/inbox/identity.ts` (teléfono normalizado o `bsuid:<id>`) |
| Conectar TU propio bot en vez del agente | `src/app/api/bot/*` + `src/server/bot/auth.ts` (X-API-Key) · quién responde (agente incluido, cerebro externo, doble respuesta): `src/server/bot/status.ts` + `GET /api/agent/brain-status` |
| La agenda (horarios, huecos, citas) | `src/server/agenda/` — detrás de la bandera `AGENDA` (`flag.ts`) |
| Cómo se entrega la reunión (Zoom, Meet…) | `src/server/agenda/connectors/` + catálogo en `src/lib/agenda-connectors.ts` · guía: [docs/agenda-conectores.md](docs/agenda-conectores.md) |
| De qué anuncio llegó cada conversación (siempre visible) | `src/server/attribution/referral.ts` (normalización) · `creativo.ts` (copia de la imagen, solo hosts de Meta) · `store.ts` · tarjeta en `src/components/anuncio-origen.tsx` |
| Los números de Resultados (ventas, agente, origen y anuncios, higiene) | `src/server/analytics/` (un módulo por sección; periodo en la zona del negocio en `period.ts`; exclusión del Laboratorio en `shared.ts`) · contratos y tasas en `src/lib/analytics.ts` · UI en `src/components/results/` · spec [019](specs/019-resultados/spec.md) |
| La atribución de anuncios y el reporte a Meta | `src/server/attribution/` — el `ctwa_clid`, la CAPI y Ajustes → Anuncios detrás de la bandera `ATRIBUCION` (`flag.ts`) + `src/lib/meta/capi.ts` · guía: [docs/atribucion-capi.md](docs/atribucion-capi.md) |
| UI | `src/components/` + `src/app/(app)/` |

Los mocks del entorno de pruebas viven en `src/app/api/dev/` (wa-mock +
ai-mock) tras un gate único (`src/lib/dev-guard.ts`): 404 incondicional en
producción.

**Identidad de contacto**: Meta está migrando de teléfono a Business-Scoped
User IDs, así que `from` puede no venir. La llave estable es
`contact.wa_identity` (teléfono normalizado 521→52, o `bsuid:<id>`); `phone` es
un atributo OPCIONAL. Nunca asumas que un contacto tiene teléfono.

**Cerebro externo**: `/api/bot/*` (autenticada por `BOT_API_KEY`) deja que un
microservicio propio conduzca la conversación sin que el token de WhatsApp
salga del CRM: marcar leído + "escribiendo…", descargar adjuntos y reiniciar la
conversación de pruebas. Respeta `conversation.ai_enabled`/`handoff_at` igual
que el agente in-process. Sin la key, esa superficie responde 401 y el CRM
funciona igual.

## Reglas de la constitución (no negociables)

Ver [.specify/memory/constitution.md](.specify/memory/constitution.md).

- **Soberanía (II, endurecida — 1.4.0)**: el NÚCLEO depende solo de WhatsApp
  Cloud API + proveedor LLM OpenRouter-compatible opcional; prohibido meterle
  S3/R2, email, billing u otros terceros. Un servicio de terceros solo entra
  como **conector opcional**: apagado por defecto tras bandera (patrón
  ADR-001), aislado tras adaptador con contrato público, con camino sin
  dependencia externa y degradación definida (su fallo jamás bloquea la
  operación core), credenciales del negocio cifradas, y CI que lo prueba
  apagado y encendido. Auth y BD self-hosted.
- **Seguridad (I)**: secretos cifrados en reposo (AES-256-GCM, `lib/crypto`);
  jamás al cliente ni a logs. El token de WhatsApp solo muestra sus últimos 4.
- **Multi-tenancy (III)**: `organization_id` NOT NULL en toda tabla de dominio;
  toda query pasa por `scoped()` de `src/lib/db/tenant.ts`.
- **Idempotencia (IV)**: webhooks dedup por `wa_message_id` UNIQUE; estados
  monotónicos; seeds y migraciones re-ejecutables.
- **Sandbox del Laboratorio**: las conversaciones `is_test` JAMÁS tocan la API
  real — el sender lanza excepción (no lo "arregles": es un guardrail). Lo
  mismo vale para la agenda: una cita de prueba nunca llega a un conector.
- **Módulos opcionales (015, 016)**: lo que no usa toda instancia va detrás de una
  bandera de despliegue, apagado por defecto, con su superficie en 404 y la
  migración aplicada igual. Nunca en una rama aparte
  ([ADR-001](docs/adr-001-canales-opcionales.md),
  [ADR-002](docs/adr-002-conectores-de-agenda.md)).

## Variables de entorno

`pnpm init-env` crea el `.env` con los secretos ya generados y `pnpm doctor`
lo valida con el mismo esquema del arranque (`safeParseEnv` en
`src/lib/env.ts`), prueba la base, `MEDIA_DIR` y el token de WhatsApp.
Ver `.env.example` (cada una con guía inline). Las claves: `APP_BASE_URL`,
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY` (32 bytes base64),
`META_WEBHOOK_VERIFY_TOKEN` (segmento secreto del webhook), `META_APP_SECRET`
(opcional, firma). La IA se configura desde la app (Ajustes → IA: proveedor,
modelo y llave cifrada, con «Probar conexión»); las variables solo son el
respaldo mientras no haya nada guardado ahí:

```bash
OPENROUTER_API_TOKEN=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
OPENROUTER_JUDGE_MODEL=anthropic/claude-haiku-4.5   # opcional: juez más barato
```

Para el self-test local existe además el modo de pruebas interno (mocks) —
ver `specs/001-vocero-core/quickstart.md`. Nunca actives mocks en producción.

## Manejo de credenciales (obligatorio)

Cuando una feature necesite una variable/credencial nueva: (1) agrégala a
`.env` como placeholder `REEMPLAZA_...` (append), (2) deja guía inline `#` de
cómo obtenerla, (3) resume en el chat y sigue. `.env` está gitignored; para
deploy, las vars van también en la plataforma de hosting (runtime, no build).

## Definición de Hecho REFORZADA (obligatoria)

"Typecheck + lint + build (+ tests)" es el piso, NO el techo. Una feature no
está "Hecha" hasta correr el **self-test de COMPORTAMIENTO de punta a punta**
(Playwright + mocks: `WA_MOCK_ENABLED=true`, `META_GRAPH_BASE_URL` → wa-mock,
`OPENROUTER_BASE_URL` → ai-mock) y dejarlo verde: flujo real como usuario,
resultado observable, y el camino infeliz degradando sin colgarse. Prohibido
delegar la prueba al usuario. Si algo depende de un LLM/proveedor externo,
todo turno tolera formato inesperado con extracción robusta + reintentos — un
hipo del proveedor nunca tumba el turno. Al detectar un fallo: diagnostica,
corrige y re-verifica tú mismo hasta verde (loop de auto-corrección).

Gate técnico:

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Guiones E2E por historia en `tests/e2e/*.md`. Parte de ellos ya están
automatizados: con la app viva y los mocks encendidos, `pnpm test:e2e`
(`scripts/e2e-selftest.mjs`) los conduce contra la app real y sale distinto de
cero si algo falla. Al agregar una historia, extiende el arnés en vez de dejar
solo el `.md`.

## Modo Objetivo — Loop SDD

Cuando el dueño da una META (no prompts paso a paso): Discover → Plan →
Execute → Verify → Iterate, de forma autónoma, volviendo solo con el objetivo
verificado en vivo o con un bloqueo real (decisión de producto, credenciales,
acción irreversible/costosa). Agrupa TODAS las preguntas bloqueantes al inicio.
El estado durable son los artefactos SDD en `specs/` (spec/plan/tasks) —
manténlos al día. Invocable como `/loop-sdd <objetivo>`.

## Memoria persistente

Memoria de archivos en `memory/` (índice `memory/MEMORY.md`, cargado por
sesión). Persiste decisiones, gotchas y correcciones; no dupliques lo que el
repo ya registra. Los subagentes con `memory: project` usan
`.claude/agent-memory/`.

## Arquitectura de agentes

1. **Orquestador** = la sesión principal de Claude Code (este CLAUDE.md + skill
   `loop-sdd`).
2. **Subagentes** (`.claude/agents/`): `deploy-ops` (deploy/logs/healthchecks,
   no escribe código de app) · `public-site-builder` (páginas públicas/legales
   y config de paneles externos).
