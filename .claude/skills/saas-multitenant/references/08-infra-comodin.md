# 8 · Infraestructura comodín (DNS, TLS y ruteo)

Referencia probada: Coolify con Traefik como proxy y DNS en Cloudflare. Los
principios aplican a Caddy, Nginx o cualquier otro proxy.

## DNS

```
A     tudominio.com      → IP del servidor
A     *.tudominio.com    → IP del servidor
CNAME www                → tudominio.com
```

- Si usas Cloudflare, déjalos **sin proxy** (nube gris) para que el certificado
  lo emita tu servidor.
- Antes de mover los nameservers, revisa que no pierdas registros MX/TXT de
  correo.

## TLS comodín: exige DNS-01

Un certificado `*.tudominio.com` **no se puede emitir con el desafío HTTP**; Let's
Encrypt exige el desafío DNS-01. Opciones:

1. **DNS-01 con la API del DNS** (recomendado): en Traefik, un resolver ACME
   con `dnsChallenge` del proveedor (p. ej. Cloudflare) y un token con permiso
   **solo** `Zone:DNS:Edit` de esa zona. Úsalo en un almacén ACME separado y
   deja convivir el resolver HTTP que ya tenías para las otras apps.
   La app lo pide con sus etiquetas:
   `tls.certresolver=<tu-resolver-dns>` y `tls.domains[0].main=*.tudominio.com`.
2. **TLS bajo demanda** (Caddy `on_demand_tls`): emite un certificado por
   subdominio al primer acceso. Obligatorio protegerlo con un endpoint `ask`
   que solo apruebe slugs existentes; si no, cualquiera agota tu cuota de Let's
   Encrypt inventando subdominios.

## Ruteo: el comodín sin secuestrar la landing

El router de la app por defecto acepta solo su `Host()` exacto: ningún
subdominio de cliente llegaría. En Traefik:

```
rule=HostRegexp(`^[a-z0-9-]+\.tudominio\.com$`)
priority=1
```

- `priority=1` (la más baja) es deliberada: los routers con `Host()` exacto (la
  landing en el apex y `www`) tienen prioridad igual a la longitud de su regla,
  mucho mayor. Sin prioridad baja, el comodín puede robarle el tráfico a la
  landing.
- Un subdominio sin app responde 503 del proxy (TLS bien, sin ruta): es la señal
  de que falta el router comodín.
- SSE / tiempo real: sin buffering en el proxy (en Caddy `flush_interval -1`).

## Variables de la edición multitenant

```bash
EDITION=cloud               # o la bandera que uses; sin ella corre como un solo negocio
BASE_DOMAIN=tudominio.com   # lvh.me en local
APP_BASE_URL=https://tudominio.com
```

Sin `EDITION`/`BASE_DOMAIN` la app arranca "sana" pero como instancia de un solo
negocio: verifica la edición activa tras cada deploy (p. ej. una ruta que solo
existe en una de las dos ediciones debe dar 404 en la otra).

## Local sin tocar DNS

`*.lvh.me` resuelve a `127.0.0.1` en DNS público: `demo.lvh.me:3000` y
`otra.lvh.me:3000` llegan a tu app local con Host distinto, sin editar el
archivo hosts. Es el mismo camino que en producción.

## Verificación tras el primer deploy

- `https://cualquiera.tudominio.com` → TLS válido (`CN=*.tudominio.com`) y la
  pantalla "esta instancia no existe".
- `https://demo.tudominio.com` → la marca de esa organización.
- `https://tudominio.com` y `www` → tu landing, no el SaaS.
- `https://alta.tudominio.com/…` → la página del alta (no un 200 de otra app).
- Las otras apps del servidor siguen respondiendo igual que antes.
