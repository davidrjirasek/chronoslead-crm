# Desarrollo local (macOS 12, Intel)

Esta Mac no tiene Docker y Homebrew compila desde fuente (Monterey es Tier 3), así que
los `docker compose` del README de Vocero no aplican aquí. Postgres va por **binarios
oficiales prebuilt** (EnterpriseDB) y Node por el instalador `.pkg` oficial.

## Herramientas (fuera del repo)

| Pieza | Ubicación | Nota |
|---|---|---|
| Node 22.23.3 | `/usr/local/bin/node` | instalador `.pkg` oficial |
| Postgres 17.8 | `~/.local/share/pgsql` | binarios de EnterpriseDB; sin Homebrew, sin Docker |
| Cluster de datos | `~/.local/share/chronoslead-pgdata` | escucha en `127.0.0.1:5433` (no 5432) |
| pnpm | se resuelve por `corepack` | ver abajo |

El cluster es el mismo que usa el repo `chronoslead` original: ahí vive su base
`chronoslead` y aquí la base `vocero`. Conviven sin tocarse.

## pnpm: siempre por `corepack`

`package.json` fija `packageManager: pnpm@11.5.0`. El pnpm global de esta Mac (11.25.0)
intenta descargarse ese binario nativo (`@pnpm/exe.darwin-x64`), que no existe para macOS
12 Intel, y falla con «Cannot verify the identity of the @pnpm/exe.darwin-x64 native
binary». `corepack` resuelve el pin bajando el paquete JS, que sí funciona:

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm install     # en vez de: pnpm install
```

Vale para todos los comandos del proyecto: `corepack pnpm dev`, `corepack pnpm test`…

## Arrancar y parar Postgres

No arranca solo al encender la Mac.

```bash
PGBIN="$HOME/.local/share/pgsql/bin"
PGDATA="$HOME/.local/share/chronoslead-pgdata"

"$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5433 -k /tmp -c listen_addresses=127.0.0.1" \
  -l "$PGDATA/server.log" start
"$PGBIN/pg_ctl" -D "$PGDATA" stop
```

## Base de datos de este repo

Creadas una sola vez; el rol `postgres` entra sin contraseña por `trust` local.

```bash
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "CREATE ROLE vocero LOGIN PASSWORD '...'"
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "CREATE DATABASE vocero OWNER vocero"
psql -h 127.0.0.1 -p 5433 -U postgres -d vocero    -c "ALTER SCHEMA public OWNER TO vocero"
```

La contraseña generada vive en `~/.config/chronoslead/vocero-db-pw` (modo 600, fuera del
repo) y ya está dentro de `DATABASE_URL` en `.env`.

## Puesta a punto desde cero

```bash
corepack pnpm install
corepack pnpm init-env        # crea .env con los secretos generados
# editar .env: APP_BASE_URL=http://localhost:3000, DATABASE_URL al puerto 5433,
#              AGENDA=on, MEDIA_DIR=./.dev-media, WA_MOCK_ENABLED=true
corepack pnpm doctor          # debe salir 10 ✓ · 0 ✗
corepack pnpm db:migrate      # 33 tablas
corepack pnpm seed:demo       # Ferretería El Martillo: 8 contactos, 8 entradas de KB
corepack pnpm dev             # http://localhost:3000
```

`pnpm init-env` deja `APP_BASE_URL=https://localhost` y un `DATABASE_URL` que apunta al
servicio `postgres` de Docker: los dos hay que cambiarlos a mano para `pnpm dev`.

## Modo plataforma (`EDITION=cloud`)

Desde la spec 101, el `.env` local corre en modo plataforma:

```bash
EDITION=cloud
BASE_DOMAIN=lvh.me            # lvh.me y todos sus subdominios resuelven a 127.0.0.1
APP_BASE_URL=http://lvh.me:3000
```

Con eso, **`http://localhost:3000` ya no sirve**: `localhost` no cuelga de `lvh.me` y la app
responde «esta instancia no existe», que es justo lo correcto. Se entra por el subdominio de
cada organización:

| Dirección | Qué hay |
|---|---|
| http://lvh.me:3000 | la **landing** comercial de ChronosLead (el apex) |
| http://lvh.me:3000/privacidad · `/condiciones-servicio` · `/eliminacion-datos` | las páginas legales |
| http://alfa.lvh.me:3000 | CRM de Ferretería El Martillo (la del seed, con la cuenta de desarrollo) |
| http://beta.lvh.me:3000 | CRM de Clínica Beta (vacía, para probar el aislamiento) |
| http://cualquierotra.lvh.me:3000 | «esta instancia no existe» |

El formulario de la landing crea el lead en la organización cuyo slug diga
`LANDING_ORG_SLUG` (por defecto `creativo-4d-group`). Si esa organización no existe, el
lead no se guarda y queda un aviso en el log del servidor — el visitante solo ve un mensaje
genérico.

`lvh.me` es un dominio público que resuelve a `127.0.0.1`: no hay que tocar `/etc/hosts`.

Para volver al comportamiento del Vocero original, deja `EDITION=` vacía y
`APP_BASE_URL=http://localhost:3000`. Los tests corren siempre en ese modo.

## El gate completo

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
```

## Cuenta de desarrollo

| Cuenta | Contraseña | Qué es |
|---|---|---|
| `david@chronoslead.test` | `~/.config/chronoslead/cuenta-dev` | propietario de la organización de esta instancia |

La contraseña no se escribe aquí: vive en ese archivo (modo 600, fuera del repo). Es una
cuenta de desarrollo contra una base local. Las de producción las fija el dueño en el
runtime de Coolify.

## Modo producción en esta Mac (y dos trampas para el despliegue)

Para medir rendimiento de verdad o reproducir un fallo que solo pasa en producción:

```bash
corepack pnpm build
cp -R public .next/standalone/public
mkdir -p .next/standalone/.next && cp -R .next/static .next/standalone/.next/static
node .next/standalone/server.js
```

Dos cosas que cuestan una tarde si no se saben, y que hay que verificar en Coolify:

1. **`pnpm start` NO sirve.** `next.config.ts` compila en `output: standalone`, y `next start`
   avisa y no arranca. El servidor es `.next/standalone/server.js`.
2. **El empaquetado no se lleva `public/` ni `.next/static/`.** Hay que copiarlos al lado del
   servidor. Si falta, el sitio responde pero **sin imágenes y sin estilos**: parece un fallo
   de diseño y es un fallo de copia.

El `Dockerfile` del repo ya hace las dos cosas; esto es para cuando se corre a mano.

## Por qué el modo desarrollo se siente lento

Next compila cada pantalla la **primera** vez que se visita. Medido en esta Mac:

| Sección | Desarrollo | Producción |
|---|---|---|
| Bandeja | 0,71 s | 0,047 s |
| Pipeline | 0,28 s | 0,071 s |
| Contactos | **8,47 s** | **0,083 s** |
| Citas | 1,66 s | 0,041 s |
| Resultados | 3,86 s | 0,042 s |

No es un problema del producto: es el modo de trabajo. Antes de concluir que algo va lento,
medirlo en producción.

## El panel del operador (`admin.*`)

```bash
PLATFORM_SUPERADMIN_EMAILS=tu-correo@dominio.com   # separados por coma
```

Se entra en **http://admin.lvh.me:3000/admin** con una cuenta cuyo correo esté en esa
lista. En cualquier otro subdominio el panel responde 404.

Sin la variable **nadie** es superadmin, a propósito: una lista vacía no abre la puerta.
Cambiar quién manda exige tocar el servidor y volver a desplegar, que es la barrera que se
quiere para eso.
