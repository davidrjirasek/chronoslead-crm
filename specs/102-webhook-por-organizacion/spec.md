# 102 — Una puerta de webhook por organización, con guardián

**Feature Branch**: `feat/102-webhook-por-organizacion`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código. Depende de la
[101](../101-resolucion-tenant-por-host/spec.md) (`EDITION=cloud`, `isCloud()`).

**Input**: paso 4 de la skill `saas-multitenant`. Cierra el atajo **#4** del
[inventario](../../docs/inventario-single-tenant.md).

**Carril**: ciclo completo. Toca el modelo de datos (una columna nueva en
`organization`, con migración) y el contrato público del webhook de entrada.
Plan en [plan.md](plan.md), tareas en [tasks.md](tasks.md).

## Problema

Hoy toda la instancia recibe los webhooks de Meta en **una sola URL**:
`/api/webhooks/wa/<META_WEBHOOK_VERIFY_TOKEN>`. Con un negocio por instancia eso
es correcto: el único que conoce la URL es su dueño.

En plataforma, esa URL la ve **cada cliente** — la pantalla Ajustes → WhatsApp se
la enseña para que la pegue en su app de Meta. Y el reparto a la organización se
hace después, leyendo el `phone_number_id` que viene **dentro del cuerpo**.

La consecuencia: cualquier cliente que conozca la URL puede enviar un cuerpo
inventado con el `phone_number_id` de otro y **meter un mensaje en la bandeja
ajena**. No necesita credenciales de nadie: la puerta es la misma para todos y
nadie comprueba que el remitente tenga derecho a hablar por esa organización.

## Decisiones

### Una puerta por organización

```
/api/webhooks/wa/{organizationId}/{firma}
```

### La firma se deriva, no se guarda

```
firma = HMAC-SHA256(ENCRYPTION_KEY, "chronoslead:webhook:v1:{orgId}:{version}")
```

Derivarla evita guardar un secreto más —que habría que cifrar para poder
mostrarlo **y** además indexar un hash para poder buscarlo—. La etiqueta de
dominio (`chronoslead:webhook:v1`) impide que ese HMAC valga en otro contexto
aunque salga de la misma clave maestra de la instancia.

`organization.webhook_token_version` (entero) permite **rotar la URL de una
organización sin tocar las demás**: se sube y la URL vieja deja de valer.

### El guardián de procedencia, que no es opcional

Una URL por organización es decorativa si la ingesta sigue enrutando solo por el
cuerpo: bastaría entrar por la puerta propia escribiendo el identificador ajeno.
Por eso la ingesta recibe de dónde viene el evento y **compara**:

| Procedencia | Qué puede escribir |
|---|---|
| `organizacion` (entró por la URL de una org) | solo en ESA organización |
| `legacy` (URL compartida vieja) | solo en edición de un solo negocio |
| `interna` (mocks, reprocesos) | cualquiera |

Si no coincide, el evento **se descarta** y se registra sin datos personales. A
Meta se le responde 200 igual, para que no reintente sin fin un evento que nunca
vamos a aceptar.

El parámetro es **obligatorio** en la firma de la función, no opcional con valor
por defecto: un camino nuevo que olvide declarar su procedencia no debe compilar.

### La firma de Meta se sigue validando

El segmento dice **a qué organización** va el evento. `X-Hub-Signature-256` dice
**que viene de Meta**. Son dos cosas distintas y se comprueban las dos.

### La URL vieja sobrevive en edición de un solo negocio

No se borra: `EDITION` apagada la deja funcionando exactamente como hoy, porque
es el camino de upstream y borrarlo es un conflicto en cada merge. Con
`EDITION=cloud` responde **404**: en plataforma esa puerta no existe.

## Comportamiento esperado

| Petición | Resultado |
|---|---|
| `POST /api/webhooks/wa/{orgA}/{firmaA}` con un `phone_number_id` de A | se procesa |
| `POST /api/webhooks/wa/{orgA}/{firmaA}` con un `phone_number_id` de **B** | descartado, 200 a Meta, aviso en el log |
| `POST /api/webhooks/wa/{orgA}/{firma de B}` | 404 |
| `POST /api/webhooks/wa/{orgA}/{firma vieja tras rotar}` | 404 |
| `POST /api/webhooks/wa/org_inventada/loquesea` | 404 |
| `GET` de handshake con `hub.verify_token` = la firma de esa organización | devuelve el `hub.challenge` |
| `GET` de handshake con el verify token de otra organización | 403 |
| URL vieja `/api/webhooks/wa/{verify token}` con `EDITION=cloud` | 404 |
| URL vieja con `EDITION` apagada | funciona como hoy |

Ajustes → WhatsApp enseña, en plataforma, la URL de **su** organización, sobre el
subdominio de esa organización.

## Criterios de aceptación

1. Con `EDITION` apagada, comportamiento idéntico al de hoy y los 1167 tests
   verdes.
2. Un evento con el `phone_number_id` de B entrando por la puerta de A **no crea
   nada** en B: ni conversación, ni contacto, ni mensaje. Comprobado contra la
   base, no solo por el código de respuesta.
3. Entrar por la puerta propia con el `phone_number_id` propio sigue creando la
   conversación igual que hoy.
4. Cambiar `webhook_token_version` de una organización invalida su URL anterior y
   **no** toca la de las demás.
5. La firma de una organización no vale en la puerta de otra.
6. La derivación de la firma está cubierta por tests: misma entrada → misma
   salida; distinta organización, distinta versión o distinta clave maestra →
   firma distinta; comparación en tiempo constante.
7. `X-Hub-Signature-256` se sigue validando cuando hay `META_APP_SECRET`.

## Fuera de alcance

- Los webhooks de Instagram, Messenger y TikTok: misma receta, pero viven tras
  `CHANNELS` y hoy están apagados. Entran cuando se enciendan.
- `BOT_API_KEY` por organización (atajo #3) — spec 103.
- El `META_APP_SECRET` por organización (hoy es uno de la plataforma, lo correcto
  en modo Tech Provider) — no es un atajo a cerrar.
