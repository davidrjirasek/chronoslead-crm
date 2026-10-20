# 108 — Tareas

- [x] `src/lib/tenant/superadmin.ts` — la comparación **pura**, separada de lo que lee la
      petición: todo el acceso al panel cuelga de ella y tiene que poder probarse sola.
- [x] `src/server/platform/superadmin.ts` — `accesoAlPanel()`: edición, Host y sesión. No
      pasa por `requireSession()` porque el superadmin **no es miembro de ninguna
      organización**.
- [x] `src/server/platform/padron.ts` — la cartera con su estado derivado, y las cuatro
      escrituras que la 104 ya definía.
- [x] `src/app/admin/page.tsx` + `src/components/admin/` — el padrón y la pantalla de «no
      tenés acceso», que dice con qué correo entraste porque el caso real no es un intruso
      sino el propio operador con la cuenta equivocada.
- [x] `src/app/admin/actions.ts` — alta, pago, suspensión, reactivación y enlace de acceso.
      **Cada una vuelve a comprobar el permiso**: una acción de servidor es una superficie
      pública y se puede invocar sin pasar por la pantalla.
- [x] `(auth)/layout.tsx` — `admin` y `alta` son puertas de la plataforma, no de una
      organización: su login se pinta aunque no haya organización detrás.
- [x] `tests/unit/superadmin.test.ts` — 6 casos.

## Verificación en vivo (2026-10-20)

| Comprobación | Resultado |
|---|---|
| `/admin` en `admin.lvh.me` | 307 → login (no hay sesión) |
| `/admin` en `alfa.lvh.me`, en el apex y en un host inventado | **404 — el panel no existe ahí** |
| Superadmin entra en `admin.*` y ve el padrón | 200, con los 7 clientes |
| **El dueño de un cliente entrando al panel** | «No tenés acceso a este panel» |
| POST a una acción sin sesión de superadmin | no cambia nada en la base |
| Marcar pago | mueve la fecha un mes |
| Suspender | pasa a suspendida (manual), **y solo esa**: las demás intactas |
| Reactivar | vuelve a activa |
| Permisos: mayúsculas, espacios, lista vacía, correo parecido | 6/6 |

Gates: typecheck ✓ · lint ✓ · **1220 tests** ✓ · build ✓ · aislamiento **40/40** ✓.

## Un bug que encontró la prueba en vivo

El padrón mostraba **0 usuarios para todos los clientes**, cuando seis de siete tenían
dueño. La subconsulta llevaba identificadores de Drizzle interpolados y se generaba mal.

Lo peligroso no era el fallo sino su forma: **un cero es plausible**. Una tabla recién
estrenada con todos los clientes en cero no llama la atención de nadie, y el dato habría
quedado mintiendo hasta que alguien lo contrastara con la base. Lo cazó comparar la salida
contra un `count(*)` directo, no mirar la pantalla.

## Pendiente de verificación humana

- **La pantalla en un navegador de verdad**: las acciones se verificaron llamando a las
  funciones del servidor y comprobando su efecto en la base, y los permisos por HTTP. Lo
  que falta es pulsar los botones. El navegador integrado bloquea los estáticos de la app,
  así que eso lo mira el dueño.
- `PLATFORM_SUPERADMIN_EMAILS` hay que ponerla en Coolify al desplegar. Sin ella **nadie**
  es superadmin: la variable vacía no abre la puerta a nadie, a propósito.
