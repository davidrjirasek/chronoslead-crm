# 127 · Plan

## La decisión que manda sobre el resto: el enlace es la credencial

No hay cuenta ni contraseña. Quien tiene el enlace puede ver y seguir
completando ese formulario. De ahí sale todo lo demás:

- El enlace lleva una **llave no adivinable** en la URL: `/?k=<llave>`.
  Va en la URL y no en una cookie justamente para que el cliente pueda
  **copiarla y seguir desde otro dispositivo**, que es la mitad del requisito
  de «cortar y volver».
- La llave se genera **del lado del servidor** en el primer guardado, con el
  mismo generador con prefijo que usa el resto del repo (`ob_…`).
- **No existe ninguna pantalla que liste formularios.** Sin eso, tener una
  llave no da ninguna pista de que existan otras.
- El navegador además la recuerda, para que el caso normal —misma persona,
  misma máquina, al otro día— no dependa de que haya guardado el enlace.
  El recuerdo es comodidad; la URL es la verdad.

## Por qué no hay ruta nueva

La raíz ya decide por Host (`src/app/page.tsx`, spec 107): la landing en el
apex, el panel en `admin.*`, el CRM en `{slug}.*`. El formulario entra como
una rama más de esa misma decisión. Inventar `/onboarding` sería el error que
107 corrigió: obligar a cada enlace a saber en qué mundo está.

`resolveTenantFromHost` gana `kind: "onboarding"`, **antes** del filtro de
reservados, igual que `alta`. Se queda además en `SLUGS_RESERVADOS` por si
alguien reordena esos chequeos.

## Datos

Tabla nueva `onboarding_respuesta`, **capa de plataforma, sin
`organization_id`** (razón en el Constitution Check de la spec).

| Columna | Para qué |
|---|---|
| `id` | `ob_…` |
| `llave` | Lo que va en la URL. UNIQUE e indexada: es por donde se busca siempre |
| `cliente` | El primer campo. Es lo que después agrupa la planilla |
| `contacto`, `correo` | Quién lo está llenando, para poder preguntarle |
| `seccion_actual` | Dónde quedó |
| `respuestas` | `jsonb`. **Una columna por pregunta sería una migración por cada cambio de redacción del cuestionario**, y el cuestionario va a cambiar con cada cliente |
| `enviado_at` | `null` mientras está a medias |
| `created_at`, `updated_at` | |

`jsonb` y no columnas porque el cuestionario es contenido, no esquema. Lo que
el esquema promete es «hay respuestas de este cliente», no qué se le preguntó.

## Guardado

Una acción de servidor por sección, no una al final: **lo que se guarda es lo
que no se pierde.** Upsert por `llave` + número de sección, así que guardar dos
veces la misma sección no duplica (Principio IV).

Límite de uso con `checkRateLimit`, como el formulario de la landing: es una
superficie pública y sin límite es un buzón abierto.

## El contenido, declarativo

Las diez secciones viven en **un solo archivo de datos** (`secciones.ts`):
título, minutos estimados, y las preguntas con su tipo (texto corto, texto
largo, una opción, varias opciones, tabla). La pantalla se dibuja desde ahí.

Así, cambiar una pregunta es editar un dato y no tocar la interfaz — que es
exactamente lo que va a pasar cuando el cuestionario se generalice para todos
los clientes.

Los minutos se reparten **por peso**, no en partes iguales: la sección 5 (las
diez consultas frecuentes) es la más larga.

## Cómo lee el operador

Un guion (`scripts/leer-onboarding.ts`) que imprime las respuestas de un
cliente. No se construye pantalla en el panel: el operador son dos personas y
lo que hace falta hoy es poder cargar el alta y armar la planilla. Pantalla, si
se pide.

## Riesgo asumido

Quien adivine o reciba una llave ve las respuestas de ese cliente. Son
horarios, precios y cómo atienden — datos comerciales, no personales
sensibles. Si alguna vez el cuestionario pide algo sensible, esto sube a
requerir sesión, y hay que recordarlo acá.
