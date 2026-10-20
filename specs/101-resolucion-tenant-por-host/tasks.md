# 101 — Tareas

- [x] `src/lib/tenant/host.ts` — resolución pura del Host, con `SLUGS_RESERVADOS`.
- [x] `tests/unit/tenant-host.test.ts` — 22 casos, incluidos los que NO pueden caer en un
      tenant (`a.b.dominio`, slug reservado, guion al borde, `dominio.evil.com`).
- [x] `src/lib/env.ts` — `EDITION` y `BASE_DOMAIN`, opcionales y documentadas.
- [x] `src/server/tenant/edition.ts` — `isCloud()` / `baseDomain()` leídos de `process.env`.
- [x] `src/server/tenant/current.ts` — `currentTenantOrg()`, sin fallback.
- [x] `src/lib/auth/session.ts` — membresía contra la organización del Host; el camino
      single-tenant intacto.
- [x] `src/server/branding.ts` — la marca sin sesión sale del Host en plataforma.
- [x] `src/lib/auth/index.ts` — `trustedOrigins` (comodín + apex + puerto),
      `allowUserToCreateOrganization: false`, mensaje de registro propio de plataforma.
- [x] `src/server/auth/registration.ts` — en plataforma el registro no se reabre ni con
      `ALLOW_SIGNUP`.
- [x] `src/components/instancia-inexistente.tsx` + gate en `(auth)/layout.tsx`.
- [x] `docs/desarrollo-local.md` — cómo se entra ahora (`*.lvh.me`) y cómo volver al modo
      de un solo negocio.

## Verificación en vivo (2026-10-20)

Dos organizaciones en la base: `alfa` (Ferretería El Martillo, con la cuenta de desarrollo)
y `beta` (Clínica Beta, sin miembros). El usuario de desarrollo es miembro **solo** de `alfa`.

| Comprobación | Resultado |
|---|---|
| Login real en `alfa.lvh.me:3000` | 200 — `trustedOrigins` y CSRF correctos |
| Sesión de `alfa` pide `/api/conversations` en `alfa` | 200 — ve lo suyo |
| **La MISMA sesión pide `/api/conversations` en `beta`** | **401 — aislado** |
| Host inventado `zzzinventado.lvh.me:3000` | 401 |
| `/login` en `alfa` | marca «Ferretería El Martillo» |
| `/login` en `beta` | marca «Clínica Beta» |
| `/login` en host inventado | «Esta instancia no existe» |
| Alta pública `POST /sign-up/email` en plataforma | 403 |
| Con `EDITION=` vacía, cualquier host | marca de la única organización (Vocero original) |

Gates: typecheck ✓ · lint ✓ · **1167 tests** (1145 de upstream + 22 nuevos) ✓ · build ✓.

## Pendiente de verificación humana

Nada en esta spec. El guion de aislamiento A/B automatizado (paso 9 de la skill) llega con la
spec 104, cuando el aprovisionamiento pueda sembrar las dos organizaciones por sí solo; lo de
arriba se comprobó con organizaciones creadas a mano.

## Hallazgo

La skill `saas-multitenant` trae `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$` para validar el
slug, documentada como «3-30 caracteres». Esa expresión acepta slugs de **un** carácter y
rechaza los de dos. Aquí se usa `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$`, que es el rango que la
skill promete.
