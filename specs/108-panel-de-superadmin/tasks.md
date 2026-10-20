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
| **Recorrido completo**: entrar en `admin.*` y llegar al panel | ✓ (el guion lo comprueba) |
| El panel con la identidad de ChronosLead | isotipo, wordmark y fondo de marca |

Gates: typecheck ✓ · lint ✓ · **1220 tests** ✓ · build ✓ · aislamiento **45/45** ✓.

## Un bug que encontró la prueba en vivo

El padrón mostraba **0 usuarios para todos los clientes**, cuando seis de siete tenían
dueño. La subconsulta llevaba identificadores de Drizzle interpolados y se generaba mal.

Lo peligroso no era el fallo sino su forma: **un cero es plausible**. Una tabla recién
estrenada con todos los clientes en cero no llama la atención de nadie, y el dato habría
quedado mintiendo hasta que alguien lo contrastara con la base. Lo cazó comparar la salida
contra un `count(*)` directo, no mirar la pantalla.

## El fallo que el dueño encontró, y lo que cambió por él

Le pedí que entrara al panel con todo «verde»: permisos, acciones, aislamiento y 1220
tests. Entró, y se quedó mirando «esta instancia no existe». El login funcionaba y el panel
funcionaba; lo roto era el camino entre los dos — el login mandaba a la raíz, y en
`admin.*` la raíz no era el panel.

Yo había probado **las piezas**, no **el recorrido**. Son cosas distintas y la segunda es la
que ve el cliente.

Lo que cambió, además del arreglo: el guion de aislamiento tiene ahora una sección
**«Recorridos completos»** que entra de verdad y comprueba **dónde termina** el usuario —no
solo que cada endpoint responda—. Son 45 comprobaciones, y si alguien vuelve a romper esa
navegación se pone rojo sin que nadie tenga que acordarse.

## Lo que el dueño encontró usándolo, y el rediseño

Probó los botones y señaló lo que ninguna prueba automática iba a ver:

| Lo que señaló | Por qué pasaba | Qué se hizo |
|---|---|---|
| «le das marcar pago y no dice nada» | la acción terminaba sin confirmar | ahora dice «Ahora está pagado hasta el …» |
| «se achicó y se quedó como tres puntitas» | el botón perdía su texto al cargar | dice «Guardando…», «Suspendiendo…» |
| «no es tan responsive, está desordenado» | **cuatro controles dentro de una celda** | la lista informa; las acciones van en un panel a todo el ancho |
| el campo «motivo» siempre visible | ocupaba sitio sin usarse | aparece solo al ir a suspender |
| la tabla se salía por la derecha | lo mismo | las filas se apilan en pantallas chicas |
| «le di copiar y me salió un error» | `navigator.clipboard` no existe sin HTTPS | copia, confirma, y si no puede explica qué hacer |
| «me dijo revisá todo, no cuál era el error» | un mensaje para los tres campos | cada campo con el suyo, verificado en 5 casos |

El diagnóstico de fondo era de estructura, no de estilo: cuatro controles no caben en una
celda ni en un portátil. Y cada acción explica ahora su consecuencia **antes** de pulsarla
—suspender avisa de que los mensajes se siguen guardando y de que pagar no la reactiva—,
que es lo que separa un panel de control de una fila de botones.

## Pendiente de verificación humana

- **La pantalla en un navegador de verdad**: las acciones se verificaron llamando a las
  funciones del servidor y comprobando su efecto en la base, y los permisos por HTTP. Lo
  que falta es pulsar los botones. El navegador integrado bloquea los estáticos de la app,
  así que eso lo mira el dueño.
- `PLATFORM_SUPERADMIN_EMAILS` hay que ponerla en Coolify al desplegar. Sin ella **nadie**
  es superadmin: la variable vacía no abre la puerta a nadie, a propósito.
