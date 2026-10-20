---
name: saas-multitenant
description: >-
  Convierte un CRM o bot de WhatsApp de "una instancia = un negocio" en un SaaS
  multitenant: una instancia, muchas organizaciones, cada una en su subdominio,
  sin que ninguna vea ni escriba datos de otra. Cubre tenant por Host,
  `organization_id` + `scoped()`, sesiones host-only, webhook firmado por
  organización, credenciales cifradas por organización, Embedded Signup desde
  un solo dominio, alta/suspensión/cuotas/superadmin, TLS comodín y el guion de
  aislamiento A/B como gate. ACTÍVATE SIEMPRE que se hable de "hacer
  multitenant", "varios clientes en una instancia", "un subdominio por
  cliente", "convertir Vocero (o mi CRM) en SaaS", "aislar los datos de cada
  cliente", "webhook por cliente", "Embedded Signup con subdominios",
  "superadmin", "suspender una cuenta", o al depurar que "un cliente vio datos
  de otro" — aunque no digan "skill". Complementa a whatsapp-saas-meta-infra y
  trabaja dentro del flujo SDD (speckit + loop-sdd).
---

# SaaS multitenant — la receta

Destilada de la edición cloud de Vocero CRM (sept-2026): lo que funcionó, en el
orden en que conviene construirlo, y las trampas que solo aparecen con dos
tenants vivos. Es una receta, no un paquete de código: los ejemplos están en
TypeScript con el stack de referencia (Next.js App Router + PostgreSQL/Drizzle +
Better Auth con plugin `organization`), pero cada patrón se porta a otro stack.

## La idea en una frase

En una instancia de un negocio, `select * from organization limit 1` significa
"mi organización". En multitenant ese atajo es **el cruce de datos esperando a
que exista la segunda organización**. Todo lo de esta skill sale de sustituir
cada "la única" por "la del Host", y de probarlo con dos tenants a la vez.

## Antes de empezar

1. Lee la constitución del proyecto (`.specify/memory/constitution.md`). Si no
   existe, usa la plantilla del arnés: los principios III (multi-tenancy) y IX
   (guion de aislamiento) son la base de todo lo que sigue.
2. Decide y escribe en el spec: dominio base, quién puede crear organizaciones
   (elegibilidad), quién paga la IA (token del cliente o de la plataforma), y si
   hay agencias/reventa. Si falta una respuesta, márcala `NEEDS CLARIFICATION`
   y sigue con lo demás.
3. Trabaja por el carril completo de speckit: casi todo aquí toca el modelo de
   datos o un contrato publicado (el webhook).

## Orden de construcción

Cada paso deja algo verificable; no avances con el anterior en rojo.

| # | Pieza | Qué queda funcionando | Referencia |
|---|---|---|---|
| 0 | **Inventario de atajos single-tenant** | Lista de cada `limit(1)`, "primera membresía", variable de entorno con un solo valor por instancia | `references/00-inventario.md` |
| 1 | **Resolución del tenant por Host** | Función pura Host → `{tenant, landing, admin, alta, desconocido}` con tests | `references/01-resolucion-tenant.md` |
| 2 | **Datos: `organization_id` + `scoped()`** | Ninguna consulta de dominio compila sin tenant | `references/02-datos-y-scoped.md` |
| 3 | **Sesión y autorización por Host** | Login en cualquier subdominio; sesión que no viaja; nadie crea organizaciones por la puerta de atrás | `references/03-sesion-y-auth.md` |
| 4 | **Webhook por organización** | URL con segmento firmado derivado + guardián de procedencia | `references/04-webhooks-por-organizacion.md` |
| 5 | **Credenciales y cerebros por organización** | Tokens de Meta/LLM cifrados por org; la llave de IA no sale de la plataforma | `references/05-credenciales-y-cerebros.md` |
| 6 | **Embedded Signup multitenant** | Conectar WhatsApp desde un solo dominio, webhook registrado por número, PIN generado | `references/06-embedded-signup-multitenant.md` |
| 7 | **Capa de plataforma** | Alta, elegibilidad de 3 estados, suspensión con gracia, cuotas, superadmin | `references/07-plataforma.md` |
| 8 | **Infra comodín** | `*.tudominio` con TLS válido y la landing sin secuestrar | `references/08-infra-comodin.md` |
| 9 | **Guion de aislamiento A/B** | El gate: dos organizaciones y ninguna ve ni escribe en la otra | `references/09-guion-aislamiento.md` |

Lee solo la referencia del paso en el que estás.

Si partes de **Vocero CRM raíz** (MIT, `kevinrivm/vocero-crm`): su modelo de
datos ya es multitenant (`organization_id` NOT NULL, helper `scoped()`, Better
Auth organization). El trabajo real es el paso 0 (localizar sus `limit(1)`),
los pasos 1, 3, 4 y 6, y la capa de plataforma. Conserva la edición de una sola
organización detrás de una bandera (`EDITION=estandar|cloud`) para poder seguir
mezclando las correcciones de upstream.

## Reglas duras

- La organización sale del **Host** (o de la ruta firmada del webhook), nunca de
  "la única", de "la primera membresía del usuario" ni de un parámetro que mande
  el navegador.
- Un subdominio que no es de nadie responde **"esta instancia no existe"**, jamás
  la marca o los datos de otra organización.
- Toda tabla de dominio: `organization_id` NOT NULL, índice que empieza por la
  organización, y consultas por `scoped()`.
- Credenciales de terceros **por organización y cifradas**; hacia fuera, solo
  los últimos 4 caracteres.
- El webhook **enruta por lo que viene dentro del cuerpo**: por eso la puerta
  (URL de la organización) y el cuerpo tienen que coincidir. Sin ese guardián,
  la URL por organización es decorativa.
- Suspender retira el **servicio**, nunca los **datos**.
- Nada está Hecho sin el **guion de aislamiento en verde** (paso 9), incluidas
  las pruebas de ESCRITURA (un evento por la puerta de A no entra en B).

## Trampas que ya costaron (resumen)

| Síntoma | Causa | Arreglo |
|---|---|---|
| El guion de aislamiento sale verde "demasiado fácil" | `fetch` de Node ignora la cabecera `Host`; todo llegó como `127.0.0.1` | Pide por hostname real: `demo.lvh.me`, `otra.lvh.me` (resuelven a 127.0.0.1) |
| El CRM se ve pero nadie puede iniciar sesión en los subdominios | Protección CSRF del auth: el `Origin` no coincide con `baseURL` | `trustedOrigins` con `*.dominio` **y** el apex aparte (el comodín no cubre el apex) |
| Un usuario se crea organizaciones fuera del alta | El plugin `organization` expone "crear organización" a cualquier sesión | Desactívalo en multitenant; solo el alta y el superadmin crean |
| El popup de Meta no devuelve el `code` en el subdominio nuevo | "Dominios admitidos para el SDK de JavaScript" no acepta comodines | Embedded Signup en un solo host (`alta.tudominio`) y regreso al tenant |
| Mensajes de una organización caen en otra, o se pierden | Override de webhook a nivel WABA: manda todos los números a la última org que guardó | Override **por número** (`webhook_configuration`) |
| La agencia deja de recibir sus otros números al conectar uno | `POST /{waba}/subscribed_apps` **sin cuerpo** borra el override de WABA de esa app | Consulta antes si la app ya está suscrita; si sí, no re-suscribas |
| El historial de un negocio aparece en el prompt de otro | Identidad del contacto UNIQUE global en el agente | Clave `(organización, identidad)` |
| Un miembro escribe en la bandeja de otro a través del cerebro compartido | Mismo secreto para todas las organizaciones | Secreto del despliegue + credencial derivada por organización |
| Una caída del proveedor de membresía "suspende" a todos | Tratar "no pude saber" como "no es miembro" | Tres estados: sí / no / indisponible |
| `alta.` en el apex devuelve 200… de otra app | El apex lo sirve la landing, no el SaaS | El alta vive en su propio subdominio reservado |
| Tests E2E intermitentes | Un guion ingiere mensajes y no los drena; el siguiente los cuenta como suyos | Cada guion que ingiere, drena al salir |

El detalle y el porqué de cada una están en las referencias.

## Verificación mínima antes de decir "Hecho"

1. Gate técnico del proyecto (tipos, lint, build, tests).
2. Tests unitarios de la resolución por Host (incluye puerto, punto final,
   mayúsculas, dos niveles de subdominio, reservados).
3. Guion de aislamiento con dos organizaciones sembradas y la app viva
   (`references/09-guion-aislamiento.md`): todas las superficies en verde.
4. Si tocaste Meta: una conexión real o contra mock, con el webhook confirmado
   por `GET /{phone_number_id}?fields=webhook_configuration`.

## Relación con otras skills

- **whatsapp-saas-meta-infra**: la base de la conexión con Meta (FB SDK, FedCM,
  `config_id`, canje del `code`, plantillas). Esta skill solo agrega lo que
  cambia cuando hay muchos tenants; donde se contradigan en el PIN o el nivel del
  override, **manda esta** (paso 6).
- **whatsapp-meta-app-review**: el espacio de revisión debe ser un tenant más,
  con datos de demostración y sin datos de clientes reales.
- **loop-sdd** y **speckit-***: el flujo con el que se construye todo esto.
