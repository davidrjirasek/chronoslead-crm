---
name: whatsapp-saas-meta-infra
description: Implementa y depura el código de un SaaS de WhatsApp multi-tenant que conecta los números de SUS CLIENTES con Embedded Signup como Tech Provider — SDK de Facebook con fedCM:false, FB.login con config_id y code, canje del code en el backend, suscripción de la WABA (subscribed_fields=messages) y override_callback_uri por tenant, registro del número con PIN, Coexistence (el cliente conecta el número que ya usa en la app WhatsApp Business, sin /register, con los cuatro campos de webhook que Meta exige), webhooks firmados, plantillas y envío, callbacks de desautorización y eliminación de datos, y el arranque del espacio de revisión con token de usuario del sistema antes del acceso avanzado. ACTÍVATE cuando pidan implementar o arreglar Embedded Signup ("el popup de Meta no abre", "sale un diálogo de Chrome", "no me ofrece conectar la app de WhatsApp Business", "este número ya está registrado en una cuenta de WhatsApp"), "no llegan los mensajes al SaaS", "conecta el número de prueba", webhooks, plantillas o envío por WhatsApp Cloud API, o preparar el código para App Review — aunque no digan "skill".
---

# Infraestructura de un SaaS de WhatsApp (Tech Provider)

**Principio:** cada cliente conecta **su propia** cuenta de WhatsApp (WABA), en **su propio** portafolio, a través de tu Embedded Signup. Tu frontend recibe un `code` y los IDs; tu backend canjea el `code` por un token del cliente, suscribe esa WABA a tu app, apunta sus webhooks al tenant correcto y registra el número. Todo va aislado por tenant y los secretos nunca salen del servidor.

## Mapa de piezas

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| SDK de Facebook + botón "Conectar con Meta" | Frontend | Abre el popup de Embedded Signup en su única variante (número nuevo **o** la cuenta de la app WhatsApp Business, el cliente elige dentro); recibe el `code` y el evento `WA_EMBEDDED_SIGNUP` (`FINISH` o `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`) |
| Alta del cliente | Backend | Canjea el `code`; verifica que el número pertenece a la WABA; suscribe la WABA; `override_callback_uri` por tenant; registra el número con PIN si es nuevo, **nunca** si vive en la app |
| Webhook | Backend público | `GET` de verificación (handshake) + `POST` firmado con mensajes, estados y cambios de plantillas |
| Envío y plantillas | Backend | Graph API con el token **del tenant**: plantillas, texto libre en la ventana de 24 h, estados |
| Cumplimiento | Páginas + backend | Privacidad, términos, eliminación de datos (callback con `signed_request`) y desautorización |
| Datos | Base de datos | Credenciales cifradas, mensajes idempotentes, todo con `tenant_id` |

## Orden de implementación, con puerta de verificación

| # | Qué | Referencia | Puerta para seguir |
|---|---|---|---|
| 1 | Páginas legales + callbacks de eliminación y desautorización | `references/cumplimiento.md` | Las 3 URLs responden 200 por HTTPS; un `signed_request` inválido se rechaza |
| 2 | Webhook con handshake y firma | `references/webhooks.md` | El handshake devuelve el `challenge` desde internet |
| 3 | Espacio de revisión conectado al **número de prueba** con token de usuario del sistema | `references/tenant-de-revision.md` | Con la app **publicada**, un "Hola" del teléfono entra a la bandeja y la respuesta llega |
| 4 | Plantillas (listar, crear, sincronizar) y envío | `references/plantillas-y-envio.md` | `hello_world` enviada y recibida; una plantilla nueva queda "pendiente" en Meta |
| 5 | Embedded Signup en el frontend | `references/embedded-signup-frontend.md` | El popup de Meta abre desde un perfil con rol en la app |
| 6 | Alta del cliente en el backend | `references/embedded-signup-backend.md` | Pruebas con Meta simulado en verde; con un admin de la app se llega al paso del número |
| 7 | Pruebas y humo | `references/verificacion.md` | Todo lo anterior automatizado |

Los pasos 3 y 4 van **antes** que Embedded Signup a propósito. Hasta que Meta conceda el acceso avanzado, los videos de App Review se graban con el número de prueba conectado por token, no con clientes reales.

## Las trampas que ya costaron horas (sept–oct 2026)

| Síntoma | Causa | Arreglo |
|---|---|---|
| Al pulsar "Conectar con Meta" sale un **diálogo nativo de Chrome** ("Iniciar sesión en tu-dominio con facebook.com"), el popup no aparece o dice "no autorizó" | El SDK trae **FedCM** activado por configuración remota; por esa vía `FB.login` solo manda `scope` y **descarta `config_id` y `response_type: "code"`** | `FB.init({ appId, version, xfbml: false, cookie: false, fedCM: false })`. Fijarlo explícitamente evita que la config remota lo reactive. Corregido en Vocero Cloud el 11-sep-2026, tras 2 h de reintentos |
| El popup se abre en blanco o lo bloquea el navegador | Hay un `await` entre el click y `FB.login` | Llama `FB.login` **directamente** en el handler del click; prepara el intento antes |
| Nunca llega el evento `FINISH` | El listener solo acepta `https://www.facebook.com` | Acepta los tres orígenes exactos: `www.facebook.com`, `web.facebook.com` y `business.facebook.com` |
| La suscripción dice `success: true` pero **no llega ningún mensaje** | (a) App **sin publicar**: solo recibe webhooks de prueba del panel · (b) falta `subscribed_fields=messages` al suscribir la WABA · (c) en Graph v26, sin la suscripción de webhooks **a nivel app**, `subscribed_apps` puede responder `success` sin conservar la WABA y el `override_callback_uri` falla con código 100 · (d) el override apunta a otro tenant | Publica la app. Luego, en este orden: suscripción de la app → `subscribed_fields=messages` → `override_callback_uri` → comprueba con `GET /{waba_id}/subscribed_apps` |
| El cliente externo termina el popup, pero tu app no recibe **ningún** permiso (ni los de WhatsApp) | El ajuste incluye un producto cuyos permisos no tienes en acceso avanzado (típico: marcaste *Click to WhatsApp Ads* sin `ads_management`). Meta es todo-o-nada | Crea un ajuste nuevo solo con productos cuyos permisos ya tengas en avanzado y cambia el `config_id` (los productos del ajuste no se editan) |
| El número queda `PENDING` y no envía | Nunca se llamó a `POST /{phone_number_id}/register` con el PIN | Regístralo con PIN de 6 dígitos **solo si** `status != CONNECTED` |
| Comportamientos distintos entre dos apps "iguales" | SDK o Graph en versiones viejas (v21) | Usa la versión vigente (v25.0 / v26.0 en sept-2026) en **una sola** variable |
| Responder a un contacto sin teléfono falla con 131026 | Llegó con BSUID (usuario sin teléfono) | Teléfono en `to`, BSUID en `recipient`. Nunca el BSUID en `to` |
| En el video de App Review no se puede abrir el popup | La UI deshabilita "Conectar" si ya hay un número | En el espacio de revisión, el botón debe abrir el popup aunque exista una conexión |
| Un error de Meta llega tal cual al usuario | El mensaje crudo puede contener el `code` o el token | Devuelve mensajes genéricos; registra solo códigos y subcódigos |
| Un cliente que usa la app WhatsApp Business escribe su número y Meta responde **«ya está registrado en una cuenta de WhatsApp»** (#2494064) o **«este tipo de cuenta no admite el uso compartido con socios»** (#2655115) | El número entró por la pantalla de número nuevo: la ventana no se abrió en la variante de Coexistence | Manda `extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }` **siempre** y suscribe la app a `account_update`, `history`, `smb_app_state_sync` y `smb_message_echoes`. La pantalla correcta ofrece «Conectar la app WhatsApp Business» junto a «número nuevo» |
| Mandas `featureType` y la ventana **sigue** pidiendo número nuevo | Casi nunca es Meta. En el caso real (8-oct-2026) la pestaña del cliente corría el JavaScript anterior al despliegue: el botón hace `fetch`, no navega, y el framework nunca recargó | Pide la **URL completa del popup**: `extras=` dice qué recibió Meta. Si no trae `featureType`, recarga fuerte (`Ctrl+Shift+R`). Solo si lo trae y aun así no sale, revisa los campos de webhook y el ajuste |
| El número de la app quedó conectado pero **lo que el dueño contesta desde el teléfono no se ve** en tu SaaS, y tu agente le contesta encima | La app no está suscrita a `smb_message_echoes`, o tu webhook lo descarta | Suscríbelo y guarda cada eco como saliente manual en la misma conversación; aparta al agente de esa conversación |
| Llamaste a `/register` sobre un número en Coexistence | El cierre trató `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` como un `FINISH` | Dos acciones en el backend, decididas por el **evento**: con la de la app, cero `/register`, cero PIN, bandera `coexistencia` |

## Variables de entorno (nombres sugeridos)

```bash
META_APP_ID=
META_APP_SECRET=              # solo servidor
META_CONFIG_ID=               # "Identificador del ajuste" de Facebook Login for Business
META_GRAPH_API_VERSION=v25.0  # la vigente
ENCRYPTION_KEY=               # 32 bytes para cifrar tokens en reposo
# Solo para el espacio de revisión, antes del acceso avanzado:
REVIEW_TENANT_SLUG=meta-review
REVIEW_WABA_ID=
REVIEW_PHONE_NUMBER_ID=
REVIEW_SYSTEM_USER_TOKEN=
```

## Reglas

- **Nunca pidas que peguen secretos en el chat.** Escribe `.env.example` con los nombres; el usuario llena `.env` en su máquina o en su panel de despliegue (Coolify, Vercel…). No imprimas valores; como mucho los últimos 4 caracteres.
- Tokens cifrados en reposo (AES-256-GCM) y jamás en logs ni respuestas.
- Toda consulta lleva `tenant_id`. Un tenant nunca ve ni usa la WABA de otro.
- Nunca vincules números de clientes al portafolio del SaaS: cada cliente en su portafolio.
- No envíes a números sin opt-in. Con el número de prueba, solo a destinatarios permitidos.
- Cada cambio se verifica **en vivo** (handshake, mensaje real) antes de decir "listo". Un test en verde con Meta simulado no prueba el popup ni la entrega.
- Para el lado del panel de Meta (campos, ajuste, textos, videos) usa las skills `whatsapp-meta-app-review` y `whatsapp-app-review-video`.

## Referencias

- `references/embedded-signup-frontend.md` — SDK, `fedCM:false`, `FB.login` con la variante única, listener, Coexistence (qué la activa, cómo se ve, la trampa de la URL del popup)
- `references/embedded-signup-backend.md` — canje, verificación de activos, suscripción, override, registro; cierre de Coexistence sin `/register`
- `references/webhooks.md` — suscripción de la app (con los campos de Coexistence), handshake, firma, payloads (`smb_message_echoes`, `account_update`), depuración
- `references/tenant-de-revision.md` — conectar el número de prueba con token de usuario del sistema
- `references/plantillas-y-envio.md` — listar, crear y sincronizar plantillas; enviar
- `references/cumplimiento.md` — páginas legales, `signed_request`, eliminación y desautorización
- `references/datos.md` — esquema mínimo multi-tenant
- `references/verificacion.md` — pruebas automáticas y checklist en vivo
