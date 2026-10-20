# Embedded Signup · frontend

El frontend tiene tres trabajos: cargar el SDK bien inicializado, escuchar el evento del popup y abrir el popup **directamente** en el click. El `code` que recibe se manda al backend y **nunca** se canjea en el navegador.

## 1. Cargar e inicializar el SDK

```ts
declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

export function cargarSdkMeta(appId: string, version: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const iniciar = () => {
      // fedCM:false es OBLIGATORIO para Embedded Signup. Sin él, la configuración
      // remota del SDK puede enrutar FB.login por FedCM, que solo envía `scope`
      // y descarta config_id / response_type: no hay code ni popup de Meta.
      window.FB!.init({ appId, version, xfbml: false, cookie: false, fedCM: false });
      resolve(window.FB);
    };
    if (window.FB) return iniciar();
    window.fbAsyncInit = iniciar;
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/es_LA/sdk.js";
    s.async = true; s.defer = true; s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("No se pudo cargar el SDK de Meta. ¿Bloqueador de anuncios?"));
    document.body.appendChild(s);
  });
}
```

- `version` = la misma versión de Graph que usa tu backend (v25.0 / v26.0 en sept-2026). No dejes una versión vieja (v21) fija en el frontend.
- Esta `version` es la de **Graph API**, no la de Embedded Signup. La versión del flujo (v4 vigente; v2 y v3 se retiran el 15-oct-2026) la decide el **ajuste** (`config_id`): un ajuste creado con el paso *Productos* ya es v4. El código no la cambia.
- Carga el SDK **solo** en la pantalla de conexión y solo para usuarios que pueden conectar (dueño/admin del tenant).
- En Next.js: `<Script src=... strategy="afterInteractive" onReady={...}>` y la inicialización en `onReady`.

## 2. Escuchar el evento del popup (antes de abrirlo)

```ts
const ORIGENES = new Set(["https://www.facebook.com", "https://web.facebook.com", "https://business.facebook.com"]);

export type EventoAlta =
  | { tipo: "finish"; wabaId: string; phoneNumberId: string }                 // número nuevo: hay que registrarlo
  | { tipo: "coexistencia"; wabaId: string; phoneNumberId?: string }         // número de la app: ya está registrado
  | { tipo: "cancelado"; paso?: string };

export function leerEventoAlta(e: MessageEvent): EventoAlta | null {
  if (!ORIGENES.has(e.origin)) return null;              // origen EXACTO, nunca "includes"
  let d: any;
  try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return null; }
  if (d?.type !== "WA_EMBEDDED_SIGNUP") return null;
  const waba = d.data?.waba_id, phone = d.data?.phone_number_id;
  const esId = (v: unknown) => typeof v === "string" && /^\d{1,32}$/.test(v);
  if (d.event === "FINISH" && esId(waba) && esId(phone)) return { tipo: "finish", wabaId: waba, phoneNumberId: phone };
  // Meta documenta este cierre SOLO con waba_id; el número, si no viene, lo resuelve el backend.
  if (d.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" && esId(waba)) return { tipo: "coexistencia", wabaId: waba, ...(esId(phone) ? { phoneNumberId: phone } : {}) };
  if (d.event === "CANCEL" || d.event === "ERROR") return { tipo: "cancelado", paso: d.data?.current_step };
  return null;
}
```

La primera vez que lo pruebes, registra en consola el `e.data` **completo** del evento. Solo trae IDs, no tokens. Así compruebas el formato real antes de fijar el parser: Meta lo ha cambiado entre versiones.

## 3. Abrir el popup (una sola variante para todos)

```ts
export function abrirEmbeddedSignup(FB: any, configId: string, alCode: (code: string) => void, alError: (m: string) => void) {
  // Directo en el handler del click: un `await` antes de esta línea y el navegador bloquea el popup.
  FB.login((resp: any) => {
    const code = resp?.authResponse?.code;
    code ? alCode(code) : alError("Meta no devolvió autorización: se canceló o se bloqueó el popup.");
  }, {
    config_id: configId,                 // reemplaza a `scope`; no uses scope
    response_type: "code",               // Login for Business requiere el code
    override_default_response_type: true,
    // La variante de Coexistence sirve para TODOS: en la misma pantalla el cliente
    // elige conectar la cuenta de su app WhatsApp Business o escribir un número nuevo.
    // El evento de cierre (paso 2) dice cuál eligió. No hagas que elija antes en tu UI.
    extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
  });
}
```

Estos tres parámetros (`config_id`, `response_type: "code"` y `override_default_response_type: true`) son los que documenta Meta para Facebook Login for Business, verificados el 11-sep-2026.

`featureType: "whatsapp_business_app_onboarding"` es lo que abre la variante que ofrece la cuenta de la app (Coexistence); sigue vigente en Embedded Signup v4. `sessionInfoVersion: "3"` va **junto con él**, tal como lo trae el ejemplo de Meta para esta variante y como se probó con la ventana real el 8-oct-2026; con él, el evento `FINISH` también llega con `version: 3`, que el parser del paso 2 ya lee. (Versiones anteriores de esta skill decían que en v4 sobraba: era una suposición, no una prueba.)

## 4. Juntar code + evento y mandar al backend

El `code` (callback de `FB.login`) y el evento de cierre (`message`) llegan **en cualquier orden**. Guarda ambos en un objeto del intento y, cuando tengas `code` + evento, llama una sola vez con la acción que corresponde al evento:

```ts
await fetch("/api/whatsapp/alta", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(
    evento.tipo === "coexistencia"
      ? { accion: "completar_app", intentoId, code, wabaId: evento.wabaId, phoneNumberId: evento.phoneNumberId }   // sin PIN: el número ya está registrado
      : { accion: "completar", intentoId, code, wabaId: evento.wabaId, phoneNumberId: evento.phoneNumberId, pin }),
  signal: AbortSignal.timeout(90_000),
});
```

- `intentoId`: pídelo al backend **antes** de abrir el popup (`POST /api/whatsapp/alta {accion: "iniciar"}`). Es de un solo uso y va atado al usuario y al tenant.
- `pin`: el PIN de 6 dígitos de verificación en dos pasos con el que se registrará un número **nuevo** (o genéralo en el backend y guárdalo cifrado). En Coexistence no hay PIN: nunca pidas ni mandes uno.
- Manda lo que Meta dice que pasó en su ventana, no lo que tu UI "esperaba": el cliente puede entrar pensando en su app y acabar dando de alta un número nuevo, o al revés.
- Timeout de 3 minutos para todo el intento; si expira, limpia el estado y deja reintentar.

## Coexistence (número que ya usa la app WhatsApp Business)

Es la misma ventana de arriba. Lo que hace falta para que Meta la enseñe y lo que se aprendió al conectarla de verdad (Vocero Cloud, 7 y 8-oct-2026):

- **Solo como Tech Provider.** Para portafolios **externos** exige el acceso avanzado; antes de eso solo aparece con portafolios donde tu perfil tiene rol en la app.
- **La app tiene que estar suscrita a cuatro campos de webhook** del objeto `whatsapp_business_account`, además de `messages`: `account_update`, `history`, `smb_app_state_sync` y `smb_message_echoes`. Es el paso 1 de la guía de Meta y la forma de "activar" la función; sin ellos, la ventana no cambia aunque mandes `featureType`. Qué hace cada uno está en `webhooks.md`.
- **Ajuste** creado con la variación *Registro insertado de WhatsApp* (el producto *WhatsApp Cloud API*; un ajuste con dos productos, como *API de Mensajes de marketing*, también funcionó).
- **Cómo se ve cuando está bien:** la pantalla del número ofrece «Conectar la app WhatsApp Business» y, en la misma lista, «Ingresar un nuevo número de teléfono». Si elige la app, la siguiente pantalla enseña el negocio detrás de ese número y Meta le manda un mensaje a su WhatsApp Business para que confirme desde el teléfono. **No hay código por SMS.**
- **Cómo se ve cuando falta algo:** la pantalla de siempre, solo número nuevo. Si el cliente escribe ahí su número de la app, Meta lo rechaza con *«Este número de teléfono ya está registrado en una cuenta de WhatsApp»* (#2494064) o *«Este tipo de cuenta no admite el uso compartido con socios»* (#2655115). Esos dos errores **no** son de Meta: son el síntoma de que el número de la app entró por el camino de número nuevo.
- **Antes de culpar a Meta, mira la URL del popup.** Cópiala entera de la barra de la ventana: trae `extras=…`. Si ahí no aparece `featureType`, tu página no lo mandó. El caso real: la pestaña de Ajustes del cliente corría el JavaScript **anterior al despliegue** (el botón hace `fetch`, no navega, así que el framework nunca detectó la versión nueva) y el popup salió con `extras={"setup":{}}`. Un `Ctrl+Shift+R` lo arregló. Con una sola variante para todos (paso 3) ese fallo ya no puede repetirse.
- **Llega `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`**, a veces solo con `waba_id`. El número ya está activo en la app del cliente: **nunca** se llama a `/register` (lo sacaría de la app). El cierre va en `embedded-signup-backend.md`.
- **Lo que cambia para el cliente**, y hay que decírselo antes: lo que conteste desde el teléfono llega a tu SaaS como `smb_message_echoes`; listas de difusión solo de lectura; mensajes temporales y de «ver una vez» apagados; se desvinculan WhatsApp Web y los dispositivos; los grupos no llegan; tope de 20 mensajes por segundo; si no abre la app en ~14 días, Meta lo desconecta (`account_update` con `PARTNER_REMOVED`).
- **Historial y contactos** (`history`, `smb_app_state_sync`): Meta deja pedirlos **una sola vez** y dentro de las **24 horas** siguientes a la conexión. Si tu producto no los importa todavía, díselo al cliente: para traerlos después tendrá que desconectar desde la app y volver a conectar.
- "Vincula una cuenta de WhatsApp Business" desde el Business Manager **no** es Coexistence: solo reclama el número como activo, no crea la sesión de API.

## Perfil sin rol = "Función no disponible"

Antes del acceso avanzado, el popup solo funciona para perfiles de Facebook **con rol en la app** (admin, developer o tester). Desde otro navegador o perfil verás "Función no disponible". No es un bug de tu código: prueba siempre con el perfil admin.
