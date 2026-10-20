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
