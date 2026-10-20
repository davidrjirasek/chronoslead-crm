# 1 · Resolución del tenant por Host

Todo el aislamiento cuelga de una función: del `Host` de la petición, ¿qué
organización es? Hazla **pura** (sin base de datos ni sesión) para poder
probarla de forma exhaustiva, y pon la consulta a la base en una segunda capa.

## Capa 1 — función pura

```ts
export const SLUGS_RESERVADOS = new Set([
  "www", "admin", "alta", "api", "app", "mail", "smtp", "imap",
  "static", "assets", "cdn", "status", "soporte", "ayuda", "blog", "docs", "panel",
]);

// 3-30 caracteres, minúsculas, dígitos y guiones; sin guion al inicio ni al final.
const SLUG_VALIDO = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

export type TenantHost =
  | { kind: "tenant"; slug: string }
  | { kind: "landing" }      // apex o www
  | { kind: "admin" }        // panel del operador
  | { kind: "alta" }         // registro y Embedded Signup
  | { kind: "desconocido" }; // ajeno al dominio, reservado o inválido

export function normalizarHost(host?: string | null): string {
  if (!host) return "";
  let h = host.trim().toLowerCase();
  if (h.startsWith("[")) {                    // IPv6: [::1]:3000
    const cierre = h.indexOf("]");
    h = cierre === -1 ? h : h.slice(0, cierre + 1);
  } else {
    const i = h.lastIndexOf(":");
    if (i !== -1) h = h.slice(0, i);          // quita el puerto
  }
  return h.endsWith(".") ? h.slice(0, -1) : h; // quita el punto final del FQDN
}

export function resolveTenantFromHost(host: string | null | undefined, baseDomain: string): TenantHost {
  const h = normalizarHost(host);
  const base = normalizarHost(baseDomain);
  if (!h || !base) return { kind: "desconocido" };
  if (h === base) return { kind: "landing" };
  if (!h.endsWith(`.${base}`)) return { kind: "desconocido" };

  const etiqueta = h.slice(0, h.length - base.length - 1);
  if (etiqueta.includes(".")) return { kind: "desconocido" }; // a.b.dominio no es de nadie
  if (etiqueta === "www") return { kind: "landing" };
  if (etiqueta === "admin") return { kind: "admin" };
  if (etiqueta === "alta") return { kind: "alta" };
  if (!SLUG_VALIDO.test(etiqueta) || SLUGS_RESERVADOS.has(etiqueta)) return { kind: "desconocido" };
  return { kind: "tenant", slug: etiqueta };
}
```

**Por qué cada detalle:**

- **Puerto**: en local el Host es `demo.lvh.me:3000`.
- **Punto final**: `demo.tudominio.com.` es un nombre válido en DNS; sin
  normalizarlo, un cliente real vería "esta instancia no existe".
- **Un solo nivel**: aceptar `a.b.tudominio` permitiría que un host inventado
  cayera en un tenant real.
- **Reservados**: si un cliente registra `api` o `alta`, se queda con una puerta
  de la plataforma, y quitársela después es romperle su CRM. `demo` NO se
  reserva: es el nombre natural de una organización de prueba.
- `baseDomain` entra como parámetro para que el test cubra producción
  (`tudominio.com`) y local (`lvh.me`) sin tocar variables.

## Capa 2 — la organización de la petición

```ts
async function requestHost(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-host") ?? h.get("host"); // el proxy pone x-forwarded-host
  } catch {
    return null; // fuera de una petición (tarea de fondo): no hay tenant que adivinar
  }
}

export async function currentTenantOrg() {
  if (!isCloud()) return laUnicaOrganizacion();       // edición de un solo negocio
  const host = resolveTenantFromHost(await requestHost(), env.BASE_DOMAIN);
  if (host.kind !== "tenant") return null;            // → "esta instancia no existe"
  return orgBySlug(host.slug);                        // null si el slug no es de nadie
}
```

- Si devuelve `null` en una superficie de tenant, la respuesta es la pantalla
  "esta instancia no existe", nunca un fallback a otra organización.
- Las **tareas de fondo** no tienen Host: reciben el `organizationId`
  explícito del evento o del registro que procesan.
- Usa `x-forwarded-host` solo si tu proxy lo sobrescribe siempre; si el
  cliente pudiera mandarlo directo a la app, ignóralo y usa `host`.

## Tests mínimos

- `demo.tudominio.com` → tenant `demo`; `DEMO.TudoMinio.com.` → tenant `demo`.
- `demo.lvh.me:3000` con base `lvh.me` → tenant `demo`.
- `tudominio.com`, `www.tudominio.com` → landing; `admin.` → admin; `alta.` → alta.
- `a.b.tudominio.com`, `api.tudominio.com`, `-x.tudominio.com`, `otro.com` → desconocido.
- `tudominio.com.evil.com` → desconocido.
