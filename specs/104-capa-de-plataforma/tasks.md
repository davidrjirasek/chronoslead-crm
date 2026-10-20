# 104 — Tareas

- [x] `src/lib/tenant/estado.ts` — el estado derivado de la fecha de pago y de la
      suspensión manual. Puro: recibe los datos y «hoy», no consulta nada.
- [x] `tests/unit/estado-organizacion.test.ts` — 13 casos, con los bordes día 0, día 7,
      día 8, sin fecha, 0 días de gracia y «pagar no levanta la suspensión manual».
- [x] `src/lib/db/schema.ts` + `drizzle/0022_estado_de_organizacion.sql` —
      `paid_through`, `suspended_at`, `suspended_reason`, aditivas y nullables.
- [x] `src/server/tenant/current.ts` — la organización de la petición viene con su estado.
- [x] `src/lib/auth/session.ts` — una organización suspendida no entra, ni el dueño.
- [x] `src/server/tenant/servicio.ts` — `organizacionConServicio()`, para el trabajo en
      segundo plano, que corre sin Host ni sesión.
- [x] `src/server/ai/trigger.ts` — el agente no contesta por una organización suspendida.
- [x] `src/components/avisos/aviso-de-gracia.tsx` + `(app)/layout.tsx` — el cartel con los
      días que quedan, sobre el molde del aviso de IA que ya existía.
- [x] `scripts/provision.ts` + `pnpm provision` — el alta. Idempotente, valida el slug con
      la MISMA función que resuelve el Host, y escribe la contraseña inicial en
      `.provision/{slug}.txt` con modo 600 en vez de imprimirla.
- [x] `.gitignore` — `.provision/`.

## Verificación en vivo (2026-10-20)

Alta de una organización nueva, `sonrisa` (Clínica Sonrisa), sobre una base que ya tenía
`alfa` y `beta`.

| Comprobación | Resultado |
|---|---|
| `pnpm provision` crea organización, dueño, membresía y 5 etapas de pipeline | ✓ |
| Correrlo otra vez con el mismo slug | «ya existe, no se tocó nada» |
| Slug reservado (`api`) | rechazado, con el porqué |
| Permisos del archivo de contraseña | `-rw-------` (600) |
| El dueño nuevo entra en `sonrisa.lvh.me:3000` | 200 |
| Esa misma sesión en `alfa.lvh.me:3000` | 401 — aislada |
| `paid_through` hace 3 días (gracia) | entra, 200 |
| `paid_through` hace 8 días | **401 — cortada** |
| `alfa` en ese mismo momento | 200 — **solo se cortó la que debía** |
| Tras poner `paid_through` a futuro | 200 — vuelve, con todo intacto |
| **WhatsApp a una organización suspendida** | **se guarda** (22 → 23 entrantes) y **el agente NO responde** (19 → 19) |
| El mismo WhatsApp con la organización activa | se guarda (23 → 24) y **el agente SÍ responde** (19 → 20) |

Gates: typecheck ✓ · lint ✓ · **1205 tests** (1192 + 13) ✓ · build ✓.

## Fallo encontrado por la prueba en vivo

La primera corrida dejó esto: el mensaje se guardaba, pero **el agente contestaba igual con
la organización suspendida**. El candado estaba en la sesión y el turno del agente corre en
`after()`, sin sesión y sin Host. De ahí sale `src/server/tenant/servicio.ts`, que consulta
el estado por `organizationId`, y la comprobación en `trigger.ts`. Los tests unitarios no lo
habrían encontrado: era un camino, no una función.

## Pendiente de verificación humana

Nada en esta spec. La fecha de `paid_through` se movió a mano por SQL, que es exactamente
como se operará hasta que exista el panel (spec 106) o el cobro automático.
