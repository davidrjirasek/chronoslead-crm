# 101 — La organización es la del Host

**Feature Branch**: `feat/101-resolucion-tenant-por-host`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código.

**Input**: paso 1 (resolución del tenant) y paso 3 (sesión y autorización) de la
skill `saas-multitenant`, instalada con el arnés. Los atajos que cierra están en
[docs/inventario-single-tenant.md](../../docs/inventario-single-tenant.md): **#1**
(la organización sale de la primera membresía), **#2** (la marca sin sesión toma
«la única organización») y **#8** (el registro se cierra contando organizaciones).

**Carril**: ciclo completo. No toca el modelo de datos ni ninguna migración, pero
cambia el contrato interno más cargado del repo —de dónde sale `organizationId`—
y añade dos variables de entorno. Plan en [plan.md](plan.md), tareas en
[tasks.md](tasks.md).

## Problema

Vocero resuelve «qué organización es esta» preguntando en qué organización está el
usuario: `select … from member where user_id = ? limit 1`. Con un negocio por
instancia la respuesta siempre es correcta. Con dos organizaciones deja de serlo, y
no de forma visible: devuelve **una organización válida, pero puede no ser la que
el visitante pidió**. `clientea.chronoslead.com` serviría los datos de B si el
usuario resulta estar apuntado en B.

El mismo patrón aparece sin sesión: `getBrandingContext()` toma «la única
organización de la instancia» para pintar el logo, los colores y el favicon del
login. El cliente B vería la marca del cliente A antes de escribir su contraseña.

Nada de esto es un defecto de Vocero: es coherente con su constitución, que dice
«una instancia = un negocio». Deja de serlo en el momento en que esa frase deja de
ser verdad.

## Decisiones

### La organización se resuelve por el Host, y solo por el Host

`{slug}.chronoslead.com` → `organization.slug`. No hay plan B. Si el Host no
resuelve a una organización, la respuesta es «esta instancia no existe»; **nunca**
una caída a «la primera», «la única» o «la del usuario». Una caída así reintroduce
exactamente el fallo que esta spec cierra, y lo haría silenciosamente.

### Todo detrás de `EDITION=cloud`

Sin esa variable el repo se comporta como el Vocero original: una instancia, un
negocio, la organización del usuario. Con ella, el Host manda. Es la condición para
poder seguir trayendo correcciones de upstream sin pelear en cada merge.

### Dos candados, no uno

El aislamiento de sesión no puede depender del navegador:

1. **Cookies host-only**: la sesión de `a.chronoslead.com` no viaja a
   `b.chronoslead.com`. Es la primera línea, pero el servidor no debe confiar en
   ella.
2. **Membresía contra la organización del Host**: aunque llegara una sesión válida
   por cualquier vía, sin membresía en ESA organización la respuesta es 401.

Un usuario con dos organizaciones iniciará sesión en cada subdominio por separado.
Es el precio del aislamiento y es deliberado: no es un defecto a corregir después.

### La autorización se revalida en cada operación

El `organizationId` no se guarda en la cookie como fuente de verdad. Se resuelve
del Host y se comprueba contra la base en cada petición, para que revocar un acceso
o suspender una organización surta efecto de inmediato y no al expirar una sesión.

### Las puertas traseras del plugin de auth se cierran

Better Auth expone «crear organización» a cualquier usuario autenticado. En
plataforma eso es un alta sin pasar por el operador: se desactiva. El registro
público (`/register`) responde 404 con `EDITION=cloud`, y la regla «abierto mientras
no haya organizaciones» desaparece: las organizaciones las crea solo el operador.

### `trustedOrigins` incluye el comodín, el apex y el puerto

Con un subdominio por organización, el `Origin` de un login legítimo nunca coincide
con el `baseURL` del auth y la protección CSRF rechazaría **todos** los inicios de
sesión: el CRM se vería y nadie entraría. El apex va aparte (`*.dominio` no cubre
`dominio`) y el puerto va aparte (`http://*.lvh.me` no cubre
`http://demo.lvh.me:3000`).

## Comportamiento esperado

### Resolución del Host (función pura, sin base de datos ni sesión)

| Host | Base | Resultado |
|---|---|---|
| `demo.chronoslead.com` | `chronoslead.com` | organización `demo` |
| `DEMO.ChronosLead.com.` | `chronoslead.com` | organización `demo` (mayúsculas y punto final del FQDN) |
| `demo.lvh.me:3000` | `lvh.me` | organización `demo` (puerto) |
| `chronoslead.com`, `www.chronoslead.com` | `chronoslead.com` | landing |
| `admin.chronoslead.com` | `chronoslead.com` | panel del operador |
| `alta.chronoslead.com` | `chronoslead.com` | alta / Embedded Signup |
| `a.b.chronoslead.com` | `chronoslead.com` | desconocido (un solo nivel) |
| `api.chronoslead.com` | `chronoslead.com` | desconocido (slug reservado) |
| `-x.chronoslead.com` | `chronoslead.com` | desconocido (slug inválido) |
| `chronoslead.com.evil.com` | `chronoslead.com` | desconocido |
| `otro.com` | `chronoslead.com` | desconocido |

`demo` **no** se reserva: es el nombre natural de una organización de prueba.

### Superficies

- **Subdominio de una organización que existe**: funciona como hoy, con los datos de
  esa organización.
- **Subdominio sin organización**, o Host desconocido: pantalla «esta instancia no
  existe». Nunca datos ni marca de otra organización.
- **Login, marca y favicon** (sin sesión): salen de la organización del Host. Sin
  organización, la marca por defecto de ChronosLead, no la de nadie.
- **Tareas en segundo plano** (agente, Laboratorio, despacho): no tienen Host.
  Reciben el `organizationId` explícito del evento o del registro que procesan, como
  ya hacen hoy. Esta spec no las cambia.

## Criterios de aceptación

1. Con `EDITION` sin definir, el comportamiento es idéntico al de Vocero hoy y los
   1145 tests siguen verdes.
2. Con `EDITION=cloud`, una petición a `a.lvh.me:3000` con sesión de un usuario que
   solo pertenece a B responde **401**, no datos de B.
3. Con `EDITION=cloud`, el login de `b.lvh.me:3000` muestra la marca de B aunque A
   sea la primera organización de la tabla.
4. Un Host sin organización muestra «esta instancia no existe» y no filtra el nombre
   ni el logo de ninguna organización.
5. La función pura de resolución cubre en tests los doce casos de la tabla de
   arriba.
6. Con `EDITION=cloud`, `POST /register` responde 404 y el endpoint de «crear
   organización» de Better Auth responde 403.
7. Un login real funciona en `a.lvh.me:3000` (es decir: `trustedOrigins` está bien y
   CSRF no lo rechaza). Este punto no lo cubre un test unitario.
8. `grep` no encuentra ningún `limit(1)` sobre `organization` ni sobre `member` que
   decida la organización actual fuera de la edición de un solo negocio.

## Fuera de alcance

Van en specs propias, y hasta entonces los atajos siguen anotados en el inventario:

- **Webhook con segmento por organización y guardián de procedencia** (atajo #4) — spec 102.
- **`BOT_API_KEY` por organización** (atajo #3) — spec 103.
- **Capa de plataforma**: padrón de organizaciones, superadmin, suspensión,
  aprovisionamiento — spec 104.
- **El guion de aislamiento A/B** completo (paso 9 de la skill) — entra con la 104,
  cuando existan dos organizaciones sembradas de verdad. Esta spec se prueba con dos
  organizaciones creadas a mano.
- Cuotas, `BRAIN_DISPATCH_URL` por organización, banderas por plan.
