# 101 — Plan

## Constitution Check

| Principio | Cómo lo cumple |
|---|---|
| I · Seguridad de datos | El cambio existe para cerrar un cruce entre organizaciones. No añade secretos ni superficies. |
| III · Multi-tenancy real | Es la implementación literal de «el tenant se resuelve por subdominio» y «prohibido el patrón primera membresía». |
| Governance · fork delgado | Todo detrás de `EDITION=cloud`; el camino de upstream queda intacto y sus 1145 tests siguen verdes sin tocarlos. |

## Capas

1. **Pura** — `src/lib/tenant/host.ts`: del Host, qué clase de puerta es. Sin base de datos,
   sin sesión, sin `headers()`. Es donde vive el riesgo sutil, así que es la que se prueba
   de forma exhaustiva.
2. **Edición** — `src/server/tenant/edition.ts`: `isCloud()` y `baseDomain()`, leídos de
   `process.env` directo (molde de `src/server/agenda/flag.ts`), para que preguntar en qué
   edición corre la instancia no dependa de que todo el entorno valide.
3. **Petición** — `src/server/tenant/current.ts`: `currentTenantOrg()`. `null` significa
   «esta instancia no existe», nunca «usa otra».
4. **Consumidores** — la sesión (`src/lib/auth/session.ts`), la marca sin sesión
   (`src/server/branding.ts`), la configuración de auth (`src/lib/auth/index.ts`), el gate de
   registro (`src/server/auth/registration.ts`) y la pantalla de Host desconocido.

## Riesgo principal y cómo se contiene

El riesgo no es escribir la resolución: es que **alguien la esquive**. Por eso `currentTenantOrg()`
no tiene parámetro de «organización por defecto» ni fallback: una llamada que no encuentra
organización devuelve `null` y quien la consume decide, visiblemente, qué hacer con eso.

El segundo riesgo es `trustedOrigins`: mal puesto, el CRM se ve y nadie entra. No lo detecta
ningún test unitario, solo un login real contra un subdominio.

## Sin migración

No toca `src/lib/db/schema.ts`. `organization.slug` ya existe y es único.
