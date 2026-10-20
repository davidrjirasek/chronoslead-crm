# Inventario de atajos «una instancia = un negocio»

Paso 0 de la skill `saas-multitenant`. Es la lista de todo lo que Vocero resuelve
asumiendo que solo hay un negocio en la instancia. **Nada de esto es un bug en Vocero**:
es coherente con su constitución original. Pasa a ser un cruce de datos en cuanto exista
la segunda organización.

Cada fila dice dónde está, qué pasa si se deja, y detrás de qué va el arreglo. Todo lo
nuevo entra tras `EDITION=cloud`: sin esa variable, el repo sigue comportándose como el
Vocero original.

Gravedad: 🔴 cruza datos entre clientes · 🟠 impide operar a varios · 🟡 ajuste.

## Los atajos

| # | Dónde | Qué hace hoy | Qué pasa con dos organizaciones | Grav. |
|---|---|---|---|---|
| 1 | `src/server/auth/on-signup.ts` → `resolveMembership()`, consumido por `requireSession()` en `src/lib/auth/session.ts` | `select … from member where user_id = ? limit 1`: la organización activa es **la primera membresía** del usuario | Un usuario con dos membresías entra siempre a una arbitraria, y **nunca se compara contra el Host**: `clienteA.chronoslead.com` puede servir datos de B. Es el atajo central: casi todo lo demás cuelga de aquí | 🔴 |
| 2 | `src/server/branding.ts` → `getBrandingContext()` | Sin sesión (login, layout raíz, favicon) hace `select … from organization limit 1` sin `where`. El comentario lo dice: «la única organización de la instancia» | El login de cualquier cliente muestra el logo, los colores y el favicon de **otro** cliente. Filtra identidad comercial antes de autenticar a nadie | 🔴 |
| 3 | `src/lib/env.ts` → `BOT_API_KEY`; `src/server/bot/auth.ts` | **Una sola** llave de entorno abre `/api/bot/*` para toda la instancia; sin organización en la credencial | Quien tenga la llave de un cliente puede leer y escribir conversaciones de **todos**. El presupuesto de 1200/min está dimensionado «por encima del pico de un solo negocio» | 🔴 |
| 4 | `src/server/whatsapp/webhook-url.ts`; `src/app/api/webhooks/{wa,ig,messenger,tiktok}/[webhookToken]/route.ts` | La URL del webhook es `/api/webhooks/wa/$META_WEBHOOK_VERIFY_TOKEN`: **un solo token** para la instancia entera | Todos los clientes comparten la misma puerta. El enrutado a la organización ocurre *después*, por `phone_number_id`, así que un cuerpo manipulado no tiene ningún guardián de puerta que lo contradiga. La constitución exige URL firmada **por organización** y que la ingesta verifique que la organización del cuerpo es la de la puerta | 🔴 |
| 5 | `src/lib/env.ts` → `OPENROUTER_API_TOKEN`, `OPENROUTER_MODEL`, `OPENROUTER_JUDGE_MODEL` | Respaldo global del proveedor de IA cuando la organización no tiene credencial propia | Una organización sin llave propia gasta contra la llave de la plataforma **sin quedar atribuido a nadie**. Rompe la separación de gasto por cliente, que es justamente el modelo del negocio. (La credencial por organización ya existe y está cifrada: `src/server/ai/credentials.ts`) | 🟠 |
| 6 | `src/lib/env.ts` → `BRAIN_DISPATCH_URL`, `BRAIN_HEALTH_URL` | **Un solo** cerebro externo para toda la instancia | Si un cliente trae su propio bot, lo recibe por todos. O todos usan el mismo cerebro, o ninguno | 🟠 |
| 7 | `src/lib/env.ts` → `APP_BASE_URL`; usado para construir la URL del webhook y los enlaces absolutos | **Una sola** URL pública para la instancia | Con `{slug}.chronoslead.com`, cada organización necesita la suya. Debe derivarse del Host, no de una variable | 🟠 |
| 8 | `src/server/auth/registration.ts` → `isPublicSignupAllowed()` | `count(organization) === 0` → registro abierto; con una o más, cerrado (salvo `ALLOW_SIGNUP=true`) | El resultado acierta por accidente (con N organizaciones siempre cierra), pero la regla es la equivocada. Debe ser **siempre cerrado** salvo el aprovisionamiento del superadmin, y `ALLOW_SIGNUP` desaparecer o quedar inerte con `EDITION=cloud` | 🟡 |
| 9 | `src/lib/env.ts` → `AGENDA`, `CHANNELS`, `ATRIBUCION` | Banderas de despliegue globales: encendidas para la instancia entera | Todas las organizaciones tienen las mismas capacidades. Si algún día hay planes, esto pasa a ser por organización. **No urge**: hoy no rompe aislamiento | 🟡 |
| 10 | `src/lib/env.ts` → `MEDIA_DIR` | Un directorio de adjuntos para la instancia | Los adjuntos ya se guardan bajo `{organizationId}/`, así que no cruzan. Falta la **cuota por organización** que pide la constitución | 🟡 |

## Lo que Vocero ya trae bien y NO hay que tocar

Esto es la razón de partir de Vocero en vez de construir: el modelo de datos ya es
multitenant, solo que la instancia nunca tuvo dos inquilinos.

- **`organization_id` NOT NULL en toda tabla de dominio**, indexado con la organización
  primero.
- **`scoped()`** (`src/lib/db/tenant.ts`) es obligatorio y **lanza** si recibe un
  `organizationId` vacío: una consulta sin tenant no se escribe por accidente.
- **Credenciales de WhatsApp por organización**, cifradas en reposo
  (`src/server/whatsapp/credentials.ts`), resueltas por `phone_number_id`.
- **Credencial del proveedor de IA por organización**, cifrada, con estado activo/pausado
  (`src/server/ai/credentials.ts`).
- **White-label por organización** en `organization.metadata` + favicon propio.
- **Bus de eventos SSE por organización** (`src/server/events/bus.ts`).
- **Secretos de canal cifrados** en columnas `*_cipher` / `*_iv` / `*_tag`.

## Orden de ataque sugerido

El 1 primero: mientras la organización salga de «la primera membresía» y no del Host,
arreglar los demás no sirve de nada. Después el 2 y el 4 (las dos superficies que se
exponen sin sesión), luego el 3, y al final los 🟠 y 🟡.

El gate de todo esto es el guion de aislamiento A/B (paso 9 de la skill), con dos
organizaciones sembradas en `*.lvh.me` e **incluidas las pruebas de escritura**: que un
evento entrado por la puerta de A no aparezca jamás en B. Mientras ese guion no esté
verde, nada de esta lista está Hecho.
