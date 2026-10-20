# 106 — Tareas

- [x] `src/lib/db/schema.ts` + `drizzle/0023_enlaces_de_acceso.sql` — tabla `access_link`
      con el **hash** del token, no el token.
- [x] `src/server/platform/access-link.ts` — crear (invalidando el anterior), validar y
      consumir (fijar contraseña, marcar usado y cerrar sesiones), en una transacción.
- [x] `src/app/(auth)/activar/[token]/page.tsx` — la pantalla.
- [x] `src/components/activar/elegir-contrasena.tsx` — el formulario y **el protocolo**:
      el gestor de contraseñas explicado, y el aviso de que nadie la pedirá nunca.
- [x] `src/components/activar/enlace-no-vale.tsx` — la misma respuesta para inventado,
      caducado y usado.
- [x] `src/app/api/activar/route.ts` — superficie pública con límite por IP; deja la
      sesión iniciada para caer directo en la guía de inicio.
- [x] `src/components/auth/edicion.tsx` + login — en plataforma, «crear la cuenta
      inicial» (que daría 404) se cambia por a quién escribir si se olvidó la contraseña.
- [x] `scripts/provision.ts` — el alta entrega un enlace, ya no una contraseña. La cuenta
      nace **sin** contraseña: la primera la elige su dueño.
- [x] `scripts/acceso.ts` + `pnpm acceso` — el «olvidé mi contraseña» que Vocero no tenía.
- [x] `scripts/e2e-aislamiento.mjs` — la superficie nueva entra en el guion, en el mismo
      cambio que la crea.
- [x] `tests/unit/enlace-de-acceso.test.ts` — 7 casos de la parte pura.

## Verificación en vivo (2026-10-20)

Alta de «Tortillería Doña Mari», recorriendo lo que vive el cliente.

| Comprobación | Resultado |
|---|---|
| El alta escribe un enlace, no una contraseña | ✓, archivo en modo 600 |
| El cliente abre el enlace | ve «Bienvenido a Tortillería Doña Mari» |
| La pantalla explica qué es un gestor de contraseñas | ✓ |
| La pantalla avisa de que nadie le pedirá la contraseña | ✓ |
| El enlace de la tortillería en el subdominio de la panadería | 400 — no vale |
| Contraseña de menos de 8 caracteres | 422, con el motivo |
| Contraseña válida | 200, **y queda con la sesión iniciada** |
| Entra directo a su CRM | 200 |
| El MISMO enlace otra vez | 400 |
| Un enlace inventado | 400 — **la misma respuesta**, no se distinguen |
| Entrar después con su contraseña | 200 |

Recuperación (`pnpm acceso`):

| Comprobación | Resultado |
|---|---|
| Sesión abierta con la contraseña vieja | 200 |
| Usa el enlace de recuperación | 200 |
| **La sesión vieja deja de valer** | 401 |
| La contraseña vieja ya no entra | 401 |
| La nueva sí | 200 |

Guion de aislamiento: **39/39** (eran 34; la 106 aporta 5).
Gates: typecheck ✓ · lint ✓ · **1212 tests** ✓ · build ✓.

## Un detalle que la prueba en vivo corrigió

La primera versión generaba `http://panaderia.lvh.me/activar/…` **sin puerto**: correcto
en producción, inservible en local, donde la app vive en `:3000`. El protocolo y el puerto
salen ahora de `APP_BASE_URL`.

## Pendiente de verificación humana

Nada. El envío del enlace al cliente lo hace el operador por el canal que quiera, que es
la decisión tomada: el envío automático necesitaría un servicio de correo que la
constitución descartó.
