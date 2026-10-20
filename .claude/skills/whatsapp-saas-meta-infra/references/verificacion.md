# Verificación

Un test en verde con Meta simulado **no** prueba que el popup abre ni que el mensaje llega. Hacen falta las dos capas.

## Pruebas automáticas (con Meta simulado)

- `FB.init` se llama con `fedCM: false`, `xfbml: false`, `cookie: false`.
- El parser de eventos acepta **solo** los tres orígenes exactos y rechaza `https://www.facebook.com.evil.test`, `https://evilfacebook.com` y cadenas que no son JSON.
- `CANCEL`/`ERROR` no se tratan como conexión; `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` se distingue de `FINISH`.
- El canje del `code` **no** manda `redirect_uri` y nunca deja el `code` ni el token en el mensaje de error.
- `verificarActivos` rechaza un `phone_number_id` que no está en la WABA y **no** sigue `paging.next` (pagina con `after`).
- `finalizarAlta` llama en orden: `subscribed_fields=messages` → `override_callback_uri` → `register`; no registra si el número ya está `CONNECTED`; si la suscripción falla, no se guarda nada.
- El popup se abre **siempre** con `extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }`; con `FINISH` el backend hace las mismas llamadas de siempre, con `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` hace **cero** llamadas a `/register`, no genera PIN y guarda `coexistencia = true`.
- Con el evento de Coexistence sin número: una WABA de un solo número lo conecta; con varios, pregunta `is_on_biz_app` y conecta el único que está en la app; si hay dos o ninguno, falla sin guardar nada.
- Un `smb_message_echoes` por la URL del tenant aparece como saliente manual en la misma conversación y aparta al agente; un `account_update` con `PARTNER_REMOVED` por la URL de **otro** tenant o con firma inválida no cambia nada; por la URL propia pasa la conexión a «reconectar».
- El webhook rechaza firmas inválidas, de otra app y manipuladas; el handshake solo responde con el `verify_token` correcto.
- El `signed_request` de eliminación/desautorización se valida igual.
- **Aislamiento**: el tenant A no ve conversaciones, contactos ni credenciales del tenant B, ni escribiendo ni leyendo.

## Comprobaciones en vivo (las que valen)

| # | Comprobación | Verde cuando |
|---|---|---|
| 1 | `/privacy`, `/terms`, `/data-deletion` por HTTPS | 200 y contenido real |
| 2 | Handshake del webhook desde internet | Devuelve el `challenge` |
| 3 | App **publicada** | El panel ya no dice "Sin publicar" |
| 4 | `GET /{waba_id}/subscribed_apps` | Aparece tu app y el `override_callback_uri` del tenant |
| 5 | Entrante real | "Hola" desde el teléfono permitido aparece en la bandeja del tenant |
| 6 | Saliente real | La respuesta llega al teléfono |
| 7 | Plantilla | `hello_world` enviada desde el SaaS llega al teléfono |
| 8 | Plantilla nueva | Creada desde el SaaS, aparece en Meta con el estado que devuelve |
| 9 | Popup | "Conectar con Meta" abre el Embedded Signup con un perfil con rol en la app |
| 10 | Despliegue | `/health` (o equivalente) devuelve el commit que acabas de desplegar |
| 11 | Coexistence | Con un número que vive en la app WhatsApp Business (2.24.17+): la ventana ofrece «Conectar la app WhatsApp Business», el cliente confirma desde el teléfono, tu SaaS dice «conectado» sin pedir PIN; un mensaje desde otro teléfono entra a la bandeja; la respuesta escrita en la app aparece en tu SaaS como manual |
| 12 | URL del popup | Antes de abrirlo, copia la URL de la ventana de Meta: `extras=` trae `featureType`. Si no, el navegador corre código viejo (`Ctrl+Shift+R`) |

Registra qué fallaba antes de cada arreglo y qué comprobación lo confirma. Esa bitácora es lo que hace rápido el siguiente cliente.

## Antes de grabar los videos de App Review

Repite 3, 5, 6, 7, 8 y 9 **el mismo día** de la grabación. En la masterclass, una hora se fue en descubrir que faltaba publicar la app.
