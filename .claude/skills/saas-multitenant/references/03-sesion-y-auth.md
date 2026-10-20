# 3 · Sesión y autorización por Host

Dos candados, porque el primero depende del navegador y el segundo no:

1. **Cookies host-only**: la sesión de `a.tudominio` ni siquiera viaja a
   `b.tudominio`.
2. **Membresía contra la organización del Host**: aunque llegara una sesión
   válida, sin membresía en ESA organización la respuesta es 401.

## Candado 1 — cookies

- No actives cookies compartidas entre subdominios (en Better Auth:
  **no** uses `advanced.crossSubDomainCookies`). Por defecto la cookie queda
  ligada al host exacto.
- Consecuencia buscada: un usuario con dos organizaciones inicia sesión en cada
  subdominio por separado. Es el precio del aislamiento; no lo "arregles".

## Candado 2 — el guard de sesión

```ts
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new UnauthorizedError();

  if (isCloud()) {
    const tenant = await currentTenantOrg();                 // del Host, paso 1
    if (!tenant) throw new UnauthorizedError("Host sin organización");
    if (tenant.status === "suspendida") throw new UnauthorizedError("Organización suspendida");
    const access = await resolveAccess(session.user.id, tenant.id); // membresía o mandato vigente
    if (!access) throw new UnauthorizedError("Sin acceso a esta organización");
    return { ...access, sessionId: session.session.id };
  }
  return membresiaDeLaUnicaOrganizacion(session.user.id);    // edición de un negocio
}
```

- **Prohibido** caer a "la primera organización del usuario" cuando el Host no
  resuelve: `cualquiercosa.tudominio` abriría la sesión sobre la organización
  que el usuario tenga.
- Revalida en cada operación (no guardes el `organizationId` en la cookie como
  fuente de verdad): así una revocación o una suspensión surten efecto de
  inmediato.

## CSRF y `trustedOrigins`

Con un subdominio por organización, el `Origin` de un login legítimo **nunca**
coincide con el `baseURL` del auth, y la protección CSRF rechaza todos los
logins: el CRM se ve, pero nadie entra.

```ts
function buildTrustedOrigins(baseDomain: string, port?: string | null): string[] {
  const sufijos = port ? ["", `:${port}`] : [""];
  const out: string[] = [];
  for (const s of sufijos) {
    out.push(`https://${baseDomain}${s}`, `https://*.${baseDomain}${s}`);
    out.push(`http://${baseDomain}${s}`, `http://*.${baseDomain}${s}`);
  }
  return out;
}
```

- El **apex va aparte**: `*.tudominio.com` no cubre `tudominio.com`.
- El **puerto va aparte**: el navegador manda `http://demo.lvh.me:3000` y el
  comodín `http://*.lvh.me` no lo cubre. Este fallo no lo encuentra un test
  unitario; lo encuentra el guion de aislamiento.
- En producción deja solo `https` si no sirves nada por `http`.

## Cierra las puertas traseras del auth

- El plugin `organization` de Better Auth expone "crear organización" a
  cualquier usuario autenticado. En multitenant: `allowUserToCreateOrganization:
  false`. Las organizaciones las crea solo el alta (con elegibilidad) o el
  superadmin.
- Bloquea también sus endpoints genéricos de equipo (`/organization/*`) con un
  hook `before` y gestiona invitaciones y roles desde tu propia API, donde el
  tenant sale del Host y se aplican cuotas.
- El registro libre (`/register`) responde 404 en la edición multitenant.

## Superficies sin sesión

Login, marca, favicon, página de "olvidé mi contraseña": resuelven la
organización del Host (paso 1) y, si no hay, muestran "esta instancia no
existe". Nunca el logo ni el nombre de otra organización.
