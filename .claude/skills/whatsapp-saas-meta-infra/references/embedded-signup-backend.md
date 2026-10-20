# Embedded Signup · backend (alta del cliente)

## Contrato

```text
POST /api/whatsapp/alta   { accion: "iniciar" }                    -> { intentoId }
POST /api/whatsapp/alta   { accion: "completar", intentoId, code,
                            wabaId, phoneNumberId, pin }            -> { conectado: true, numero }
POST /api/whatsapp/alta   { accion: "completar_app", intentoId, code,
                            wabaId, phoneNumberId? }                -> { conectado: true, numero, coexistencia: true }
```

`completar` cierra el evento `FINISH` (número nuevo); `completar_app` cierra `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` (número que vive en la app WhatsApp Business). La acción la decide el **evento** que mandó la ventana, nunca una elección previa del usuario (ver «Cierre de Coexistence» abajo).

Antes de hacer nada, en cada `POST`:

- Solo el dueño o un admin del tenant.
- El `Origin` debe coincidir con el host del tenant: el intento de un tenant no se completa desde otro.
- `intentoId`: de un solo uso, atado a usuario y tenant, con TTL de 10 minutos.
- Límite de frecuencia por usuario (≈12 por minuto).
- Validación estricta: IDs numéricos, PIN de 6 dígitos, `code` ≤ 4 KB.

## Secuencia de `completar`

```ts
const G = () => `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}`;

async function graph<T>(path: string, token?: string, body?: Record<string, string>): Promise<T> {
  const r = await fetch(`${G()}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
    signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  // Nunca propagues data.error.message: puede contener el code o el token.
  if (!r.ok || data?.error) throw new ErrorMeta(data?.error?.code, data?.error?.error_subcode);
  return data as T;
}

// 1) code -> token del cliente. En el flujo del SDK de JS se canjea SIN redirect_uri.
export async function canjearCode(code: string): Promise<string> {
  const url = new URL(`${G()}/oauth/access_token`);
  url.search = new URLSearchParams({ client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, code }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new ErrorAlta("canje_fallido");
  return d.access_token;                        // cifrar ANTES de guardar
}

type Telefono = { id: string; display_phone_number?: string; verified_name?: string; platform_type?: string; status?: string };

// 2) El número elegido pertenece a la WABA autorizada (paginar con cursor, no con paging.next)
export async function verificarActivos(token: string, wabaId: string, phoneId: string) {
  let after: string | undefined, hallado: Telefono | undefined;
  for (let i = 0; i < 20 && !hallado; i++) {
    const q = `fields=id,display_phone_number,verified_name,platform_type,status&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const r = await graph<{ data?: Telefono[]; paging?: { cursors?: { after?: string }; next?: string } }>(`${wabaId}/phone_numbers?${q}`, token);
    hallado = r.data?.find(t => t.id === phoneId);
    if (!r.paging?.next || !r.paging.cursors?.after) break;
    after = r.paging.cursors.after;
  }
  if (!hallado?.display_phone_number) throw new ErrorAlta("activo_ajeno");
  if (hallado.platform_type === "ON_PREMISE") throw new ErrorAlta("requiere_migracion");
  const yo = await graph<{ id?: string }>("me?fields=id", token);   // para mapear la desautorización
  return { telefono: hallado, metaUserId: yo.id };
}

// 3) Suscribir -> override por tenant -> registrar (en ese orden)
export async function finalizarAlta(token: string, wabaId: string, tel: Telefono, pin: string, webhookUrl: string, verifyToken: string) {
  const a = await graph<{ success?: boolean }>(`${wabaId}/subscribed_apps`, token, { subscribed_fields: "messages" });
  if (!a.success) throw new ErrorAlta("suscripcion_fallida");
  const b = await graph<{ success?: boolean }>(`${wabaId}/subscribed_apps`, token, { override_callback_uri: webhookUrl, verify_token: verifyToken });
  if (!b.success) throw new ErrorAlta("override_fallido");
  if (tel.status !== "CONNECTED") {
    const c = await graph<{ success?: boolean }>(`${tel.id}/register`, token, { messaging_product: "whatsapp", pin });
    if (!c.success) throw new ErrorAlta("registro_fallido");
  }
}
```

Guarda la conexión (`tenant_id`, `waba_id`, `phone_number_id`, número visible, nombre verificado, token cifrado, `meta_user_id` y estado) **solo cuando los tres pasos confirmaron**. Si alguno falla, no guardes nada y deja reintentar: la conexión anterior del tenant se conserva.

## Por qué este orden

- **Suscribir antes de registrar:** un número no debe quedar operativo sin que tu app reciba sus eventos. Así lo pide la secuencia de Tech Provider de Meta.
- **`subscribed_fields=messages`:** con Graph v25/v26, suscribir la WABA sin declarar el campo dejó de bastar para recibir mensajes (Vocero Cloud, 10-sep-2026).
- **`override_callback_uri` por tenant:** cada cliente recibe sus eventos en **su** URL, con su `verify_token`. Sin override, todo cae en el webhook general de la app y hay que enrutar por `phone_number_id`.
- **No registrar lo que ya está `CONNECTED`:** repetir `/register` sobre un número activo puede fallar o chocar con los límites de registro. Si cambió el PIN, se gestiona aparte.

## Cierre de Coexistence (`completar_app`)

Mismo canje, misma comprobación de activos, misma suscripción y override. Tres diferencias:

```ts
// 1) Identificar el número cuando el evento trajo solo la WABA
export async function numeroEnLaApp(token: string, wabaId: string, phoneId?: string): Promise<Telefono> {
  const todos = await listarTelefonos(token, wabaId);                       // la misma paginación de verificarActivos
  if (phoneId) { const t = todos.find(t => t.id === phoneId); if (!t) throw new ErrorAlta("activo_ajeno"); return t; }
  if (todos.length === 1) return todos[0];
  if (todos.length > 20) throw new ErrorAlta("numero_no_identificado");      // no preguntes por cien números
  const enLaApp: Telefono[] = [];
  for (const t of todos) {
    const r = await graph<{ is_on_biz_app?: boolean; platform_type?: string }>(`${t.id}?fields=is_on_biz_app,platform_type`, token);
    if (r.is_on_biz_app) enLaApp.push(t);
  }
  if (enLaApp.length !== 1) throw new ErrorAlta("numero_no_identificado");   // ambiguo: falla sin efectos, no adivines
  return enLaApp[0];
}

// 2) Suscribir y override igual que siempre; NUNCA /register
export async function finalizarAltaApp(token: string, wabaId: string, webhookUrl: string, verifyToken: string) {
  const a = await graph<{ success?: boolean }>(`${wabaId}/subscribed_apps`, token, { subscribed_fields: "messages" });
  if (!a.success) throw new ErrorAlta("suscripcion_fallida");
  const b = await graph<{ success?: boolean }>(`${wabaId}/subscribed_apps`, token, { override_callback_uri: webhookUrl, verify_token: verifyToken });
  if (!b.success) throw new ErrorAlta("override_fallido");
  // Sin /register, diga lo que diga `status`: registrar por Cloud API un número que vive
  // en la app lo saca de la app. Tampoco hay PIN que generar ni guardar.
}
```

3) Guarda la conexión con una bandera `coexistencia = true` (ver `datos.md`). Es una bandera y no una consulta a Meta porque la UI la lee a cada rato, y porque cualquier camino futuro que registre o dé de baja números puede negarse con ella. Renovar el token del mismo número la conserva; cambiar de número o conectar por el camino normal la apaga.

Después del alta en Coexistence:

- Pide `history` y `smb_app_state_sync` con `POST /{phone_number_id}/smb_app_data` **solo si** tu producto los va a procesar, y hazlo enseguida: Meta lo permite una vez y dentro de las 24 h.
- El cliente se desconecta **desde la app** (Ajustes → Cuenta → Plataforma para empresas), no desde tu SaaS: `/deregister` no funciona en estos números. Tu "Desconectar" debe avisar de que también hay que hacerlo en el teléfono.
- Lee `account_update` con `PARTNER_REMOVED` / `ACCOUNT_OFFBOARDED` por la URL **de ese tenant** y marca la conexión como «hay que reconectar» (pausa envíos). Por la URL general de la app no hay firma por tenant que valga: cualquiera que la conozca podría apagarle el WhatsApp a otro. Payloads en `webhooks.md`.

## Mensajes al usuario

| Código interno | Mensaje sugerido |
|---|---|
| `canje_fallido` | Meta no pudo completar la autorización. Revisa la configuración de la app y vuelve a conectar |
| `activo_ajeno` | El número elegido no pertenece a la cuenta de WhatsApp autorizada |
| `suscripcion_fallida` / `override_fallido` | Meta no confirmó la recepción de mensajes. La conexión no se guardó; vuelve a intentarlo |
| `registro_fallido` | Meta no confirmó el registro del número. Revisa el PIN y repite la conexión |
| `numero_no_identificado` | No pudimos saber cuál de los números de tu cuenta es el de tu app WhatsApp Business. Vuelve a conectar y elige el número dentro de la ventana de Meta |
| timeout | La confirmación tardó demasiado. Actualiza el estado antes de repetir |

## Después del alta

- Muestra en la UI el número conectado con WABA ID y Phone Number ID. Es justo lo que enseña el video de App Review.
- Carga las plantillas de la WABA (`plantillas-y-envio.md`).
- Invita a "probar tu primera conversación": la recepción se confirma cuando llega el primer webhook, no antes.
