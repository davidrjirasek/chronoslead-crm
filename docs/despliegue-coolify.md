# Desplegar ChronosLead en Coolify

> **La guía base es [`INSTALL-IA.md`](../INSTALL-IA.md)**, del upstream: Ruta A
> (Coolify), **variante «construir desde el código»** — la que corresponde a un
> fork con cambios propios. Seguirla al pie de la letra desplegaría el CRM de
> Vocero, no ChronosLead.
>
> Este documento **no la reemplaza**: anota lo que cambia por ser plataforma
> multitenant. Donde no diga nada, manda `INSTALL-IA.md`.

## Qué cambia respecto a la guía del upstream

| Paso de `INSTALL-IA.md` | En ChronosLead |
|---|---|
| App de tipo **Docker Image** | **No.** Repositorio público → `davidrjirasek/chronoslead-crm`, rama `main`, build pack `dockerfile`, puerto `3000` |
| Postgres **16** | **17**, para que producción y el desarrollo local corran la misma versión. Las migraciones son SQL corriente |
| Un dominio | **Varios**: el de pruebas, el del panel y el de cada cliente (`{slug}.chronoslead.com`) |
| Cierre: «entrá y registrate» | **No aplica.** El registro público está cerrado a propósito: las altas las hace el operador con `provision.mjs` |

El resto —volumen en `/data`, variables en runtime, **sin** Pre-Deployment
Command, migraciones al arrancar— es igual.

## Lo que ya está (verificado el 2026-10-20, desde fuera)

| Pieza | Estado |
|---|---|
| Coolify | v4.4.6, proyecto `chronos-lead`, entorno `production` |
| Postgres | `postgres:17-alpine`, **Running**, dirección interna tomada |
| DNS | Cloudflare (`merlin` / `hazel`), comodín `*.chronoslead.com` → VPS |
| `chronoslead.com` y `/app/*` | La aplicación **anterior**, viva. **No se toca** |
| Repositorio | **Público** → Coolify lo clona sin llaves ni GitHub App |

> **Pendiente de seguridad, anotado:** el panel de Coolify está expuesto por
> **HTTP sin cifrar** en el puerto 8000. Las credenciales del panel —que dan
> control total del servidor— viajan en claro. Hay que ponerlo detrás de HTTPS
> o restringirlo. No bloquea el despliegue; no conviene dejarlo así.

## Las variables

Los secretos están en `~/.config/chronoslead/produccion.env` (modo 600, fuera
del repositorio). **Se copian de ahí**, nunca del chat.

### Obligatorias — sin ellas el contenedor no arranca

Son exactamente las que valida `src/lib/env.ts` al arrancar.

| Variable | Qué poner | Por qué |
|---|---|---|
| `APP_BASE_URL` | `https://nuevo.chronoslead.com` | URL pública. De ella sale la del webhook. Al cortar el dominio, cambia |
| `DATABASE_URL` | la dirección interna del Postgres | **Base NUEVA**, no la del sistema anterior |
| `BETTER_AUTH_SECRET` | del archivo | Firma las sesiones. Cambiarla echa a todos |
| `ENCRYPTION_KEY` | del archivo | Cifra los tokens de WhatsApp y las llaves de IA. **Si se pierde, esos datos no se recuperan** |
| `META_WEBHOOK_VERIFY_TOKEN` | del archivo | Solo se usa en la edición de un negocio; en plataforma cada organización tiene su puerta firmada |

### De plataforma — lo que convierte esto en multi-cliente

Ninguna existe en el upstream.

| Variable | Qué poner | Por qué |
|---|---|---|
| `EDITION` | `cloud` | **Sin esto es un CRM de un solo negocio.** Es el interruptor |
| `BASE_DOMAIN` | `chronoslead.com` | De aquí cuelgan los subdominios de cada cliente |
| `PLATFORM_SUPERADMIN_EMAILS` | el correo del operador | Quién entra al panel. **Vacía = nadie**, a propósito |
| `LANDING_ORG_SLUG` | `creativo-4d-group` | A qué pipeline caen los leads de la landing |
| `DIAS_DE_GRACIA` | `7` | Días antes de cortar por impago. Es un ajuste, no código |

### Funcionales

| Variable | Qué poner | Por qué |
|---|---|---|
| `AGENDA` | `on` | Enciende las citas |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4.5` | El modelo del agente |
| `META_GRAPH_API_VERSION` | `v25.0` | Dejar como está |
| `BOT_API_KEY` | del archivo | Habilita `/api/bot/*`. Lo necesita el guion de aislamiento contra el dominio real |
| `META_APP_SECRET` | el de la app de Meta | Valida la firma de cada webhook. Opcional pero recomendado |

**`OPENROUTER_API_TOKEN` se deja fuera a propósito.** La decisión de producto
es una llave por organización, que se pega en Ajustes → IA y se guarda cifrada.
Lo guardado en la app manda sobre la variable.

### NO poner en producción

| Variable | Por qué |
|---|---|
| `WA_MOCK_ENABLED` | Simuladores. Nunca en producción |
| `META_GRAPH_BASE_URL` · `OPENROUTER_BASE_URL` | Apuntan a los simuladores |
| `MEDIA_DIR` | La imagen ya la trae (`/data/media`). Definirla a mano es una de las causas de «no puedo subir el logo» del diagnóstico del upstream |
| `PROVISION_DIR` | Igual: la imagen la trae (`/data/.provision`) |

## Las herramientas del operador dentro de la imagen (110)

En el upstream la primera cuenta nace sola: te registrás y el primer registro
crea la organización. En plataforma eso está **cerrado** — y por eso una
imagen sin las herramientas de alta se despliega bien y después no deja entrar
a nadie. El `Dockerfile` empaqueta `provision.mjs` y `acceso.mjs` junto a
`migrate.mjs`, y fija `PROVISION_DIR=/data/.provision` para que el enlace de
primer acceso caiga en el volumen y no en un `/app` que se rehace en cada
despliegue.

Desde la terminal del contenedor, en Coolify:

```sh
ORG_SLUG=suclinica ORG_NAME="Clínica Sonrisa" \
ORG_ADMIN_EMAIL=dueno@suclinica.com node provision.mjs
```

El enlace no se imprime: queda en `/data/.provision/{slug}.txt`. Sirve **una
sola vez** y caduca a los 7 días.

## Verificación (la del upstream, más la de plataforma)

1. `https://nuevo.chronoslead.com/api/health` → `{"ok":true,…}`
2. En esa misma respuesta, **`"mediaWritable": true`** — confirma que el
   volumen de `/data` quedó montado. En `false`, los adjuntos y el logo se
   pierden en cada despliegue
3. `/login` carga con la identidad de ChronosLead
4. `admin.chronoslead.com` da el panel del operador
5. Un subdominio que no existe da «esta instancia no existe», no un error
6. Los dos recorridos completos: entrar al CRM de un cliente, y entrar al panel
   con el mismo usuario

**El guion de aislamiento NO se corre contra producción.** Siembra sus propias
organizaciones —quedarían en la base real— y da por encendidos los
simuladores, que en producción están prohibidos. Es un gate del código y vive
en local; lo que valida producción es el recorrido en vivo.

## El orden del corte

1. Aplicación nueva en `nuevo.chronoslead.com`, **sin tocar la anterior**
2. Alta de una organización de prueba con `provision.mjs`
3. **Un WhatsApp real**: respuesta del agente y cita agendada
4. Solo entonces: mover `chronoslead.com` a la aplicación nueva
5. La anterior queda **detenida, no borrada**, una semana

Al mover el apex cambian dos cosas: `APP_BASE_URL` pasa a
`https://chronoslead.com` y hay que **volver a registrar el webhook en Meta**,
porque su URL sale de esa variable.

Mismo App ID de Meta. Las rutas legales (`/privacidad`,
`/condiciones-servicio`, `/eliminacion-datos`) no cambian: la Business
Verification y el App Review apuntan ahí.

## Trampas conocidas

- **Red interna**: la app tiene que poder resolver el nombre del contenedor de
  Postgres. En Coolify eso pide que la aplicación esté conectada a la red del
  proyecto; si no, `DATABASE_URL` no resuelve y el contenedor queda unhealthy.
- **Cloudflare**: el dominio está proxyado. Con el modo SSL en *Flexible*,
  Cloudflare habla HTTP al origen y el proxy del VPS redirige a HTTPS: bucle de
  redirecciones. Tiene que estar en **Full**.
- **Los subdominios de cliente también se enrutan**: el enlace de primer acceso
  apunta a `{slug}.chronoslead.com`. Si ese dominio no está en la aplicación,
  el enlace no abre.
- El resto del diagnóstico, en `INSTALL-IA.md` → «Diagnóstico rápido».
