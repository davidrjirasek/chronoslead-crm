# Troubleshooting del panel de Meta

## `#2655111` · "La app de socio no tiene los permisos avanzados de mensajes y administración de WhatsApp Business necesarios para el registro"

Aparece **al registrar el número** dentro del Embedded Signup. Significa que la app está en **acceso estándar**: con ese nivel, Meta solo deja completar el flujo a **usuarios con rol en la app** (admin, developer o tester) y con sus propios activos.

Revisa en este orden:

1. **Rol en la app** del perfil exacto que aparece en el avatar del popup (Roles de la aplicación). Tener control total del portafolio **no** da rol en la app.
2. **WhatsApp → Información general** en **"Hazte socio"**, no en "Integrar con API".
3. **Verificación del negocio** del portafolio dueño de la app, aprobada.
4. **Versión del SDK/Graph** vigente en tu frontend (v25/v26), no una vieja (v21).
5. **Salud del portafolio y de la WABA**: si hay restricciones o una Test WABA desactivada, el flujo falla aunque todo lo demás esté bien.

Lo que **no** lo causa: publicar o despublicar la app, la lista de portafolios del popup (sale de Business Manager) ni que el portafolio dueño aparezca bloqueado (eso es normal: el dueño no se incorpora a sí mismo como cliente).

> ⚠️ Caso real (11-sep-2026): un miembro con rol **admin** en su app seguía viendo `#2655111`. En su cuenta había además una Test WABA **desactivada** por bloqueos previos y el SDK en v21. Conclusión honesta: el rol es la causa más común, **no la única**. Cuando el diagnóstico no cierra, no insistas: pasa al plan B.

**Plan B, el que siempre funciona antes del acceso avanzado:** conectar el **número de prueba** con **token de usuario del sistema** (`whatsapp-saas-meta-infra → tenant-de-revision.md`). Con eso se graban los videos y se envía la revisión.

## "Función no disponible" al pulsar Conectar con Meta

El navegador tiene iniciada una sesión de Facebook **sin rol en la app**. Abre el flujo desde el perfil administrador. Es exactamente lo que verá un cliente real hasta que tengas los dos permisos de WhatsApp **y** `public_profile` en acceso avanzado. Si WhatsApp ya está aprobado y un perfil sin rol sigue viendo esto, falta el segundo envío con `public_profile`.

## Sale un diálogo de Chrome en vez del popup de Meta

"Iniciar sesión en tu-dominio con facebook.com" → **FedCM**. Es un problema de código, no del panel: `FB.init({ …, fedCM: false })`. Ver `whatsapp-saas-meta-infra → embedded-signup-frontend.md`.

## El webhook dice que sí, pero no llega ningún mensaje

1. ¿La app está **publicada**? El panel avisa que sin publicar solo llegan webhooks de prueba.
2. ¿Está suscrito el campo `messages` (a nivel app y a nivel WABA)?
3. ¿El `override_callback_uri` apunta al tenant correcto?
4. ¿El remitente es un **destinatario permitido** del número de prueba?
5. Recarga forzada (Ctrl+F5): el navegador cachea la pantalla vieja del SaaS.

## "Currently ineligible for submission"

Falta algo en *Información básica*. Meta lista los campos: casi siempre **ícono 1024×1024**, **URL de política de privacidad** o **categoría**.

## El video no queda en verde en Uso permitido

No terminó de subir. Espera, cierra el diálogo, vuelve a abrirlo y guarda otra vez. El permiso no avanza hasta que el archivo queda registrado.

## El campo de descripción de la empresa no acepta lo que pego

Ese campo **no admite URLs**. Quítalas; en la descripción del permiso sí se aceptan.

## "URL no válida" en Eliminación de datos de usuario

Bug conocido del campo de instrucciones. Cambia el desplegable a **URL de devolución de llamada** y guarda.

## No me deja crear otro usuario del sistema administrador

Hay un límite. Reutiliza el existente: *Asignar activos* → agrega la app nueva y la cuenta de WhatsApp, control total.

## Me aparecen permisos que no pedí

`public_profile` o `business_management` en la solicitud: suprímelos con el ícono de basura. Deben quedar solo los dos de WhatsApp. `public_profile` se pide en un segundo envío, el mismo día de la aprobación (`05-despues-del-envio.md`).

## Mi portafolio aparece bloqueado en el selector del popup

Dice "This business portfolio owns …". Es por diseño: el portafolio dueño de la app no puede ser su propio cliente. Para tu número propio, usa *Configuración de la API*; para probar el flujo, otro portafolio tuyo.

## "Vincula una cuenta de WhatsApp Business" no me dio Coexistence

Esa opción solo **reclama** el número como activo: no crea la sesión de API ni pide el QR. La Coexistence real se hace por Embedded Signup con `featureType: whatsapp_business_app_onboarding`, y solo cuando ya eres Tech Provider.

## El popup pide un número nuevo y rechaza el de la app (#2494064 / #2655115)

«Este número ya está registrado en una cuenta de WhatsApp» o «este tipo de cuenta no admite el uso compartido con socios» significan que el número de la app WhatsApp Business entró por la pantalla de número nuevo. En orden: (1) copia la **URL completa del popup** y revisa que `extras=` traiga `featureType`; si no, es tu página (código viejo en el navegador: `Ctrl+Shift+R`), no Meta. (2) Si lo trae, revisa en *WhatsApp → Configuración → Campos de webhook* que estén `account_update`, `history`, `smb_app_state_sync` y `smb_message_echoes`. (3) Después, el ajuste. Detalle en `whatsapp-saas-meta-infra`.

## Mi Test WABA está desactivada

Pasa tras bloqueos por políticas. Apela desde el portafolio del dueño y, mientras, conecta un **número nuevo** en una WABA propia con token de sistema (`tenant-de-revision.md`). Sin apelar, cualquier WABA nueva de ese portafolio puede caer igual.

## Nada de lo anterior

1. Descarta un incidente global en metastatus.com.
2. Consulta por API en vez de fiarte del panel: `GET /{business-id}?fields=verification_status`, `GET /{waba-id}` → `account_review_status`, `GET /{waba_id}/subscribed_apps`.
3. Como Tech Provider tienes **soporte directo** en developers.facebook.com/support. Escríbelo en inglés e incluye App ID, WABA ID, Phone Number ID, hora exacta, qué esperabas y qué pasó. Sin tokens.
