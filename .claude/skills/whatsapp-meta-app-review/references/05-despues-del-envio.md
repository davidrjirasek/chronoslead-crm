# Después de enviar

## Tiempos y estados

- Meta muestra un plazo de **hasta 20 días**. Lo observado en casos reales: **2 a ~20 días** (envíos propios y limpios, 2–6; hechos para terceros, hasta ~20). No prometas 3–5 días a un cliente.
- **No se puede editar ni cancelar** un envío. Si detectas un error, se espera la resolución.
- El estado vive en *Revisión de la aplicación*: "Revisión en curso" → aprobado o rechazado, con el motivo literal.

## Tech Provider ≠ permisos aprobados

A veces primero llega el reconocimiento como **proveedor de tecnología** y después la resolución de los permisos. Con el badge pero sin **acceso avanzado** no puedes operar números de clientes. Espera la aprobación de los dos permisos.

A veces aparece además un formulario de confirmación de permisos: es trámite, se acepta y sigue.

## Mientras esperas

- Sigue probando el SaaS con el número de prueba conectado: bot, plantillas, bandeja, aislamiento entre tenants.
- Prepara la guía de onboarding para tus clientes (qué van a ver en el popup, qué PIN necesitan, qué método de pago pide Meta en su WABA).
- **Deja listo el segundo envío** (`public_profile`): plataforma *Sitio web* declarada, instancia y usuario de prueba para el revisor, instrucciones redactadas (plantilla abajo).
- No abras otro envío mientras este está en revisión, ni crees apps duplicadas.

## Cuando aprueben

1. **`public_profile`, el mismo día.** Sin él en acceso avanzado el Embedded Signup solo abre para perfiles con rol: los clientes ven *"Función no disponible — …estamos actualizando otros detalles de la app"* (mensaje engañoso: no menciona permisos). Recorrido real (Vocero Cloud, 23-sep-2026, aprobado en **1 h 58 min**):
   - *Casos de uso → Personalizar → Permisos y funciones* → `public_profile` (*Listo para prueba*) → **Acciones → Añadir a la revisión de la aplicación** → *Revisión de la aplicación*.
   - Aparece como **nueva solicitud**, con los dos de WhatsApp como **renovación** (no se pueden quitar; en todos los casos documentados salieron *Renewed*). **No pide video.**
   - *Uso permitido*: una casilla de confirmación para `public_profile` + *Renewal*: certificar el uso de cada permiso de WhatsApp.
   - *Gestión de datos*: viene prellenada del primer envío; revisa que siga siendo verdad.
   - *Instrucciones para el revisor*: **sí las pide**, y la pestaña sale bloqueada con *"Especifica las plataformas de la aplicación"* → *Configuración → Información básica → + Añadir plataforma → Sitio web* → **URL exacta donde inicia sesión el revisor** (si el SaaS da un subdominio por cliente, una instancia dedicada al revisor, no la URL base) → *Añadir o actualizar instrucciones*.
   - Instrucciones en inglés con los rótulos tal como aparecen en pantalla (plantilla abajo), credenciales de **la app** (nunca de Facebook), *"¿Está integrado el inicio de sesión con Facebook?"* → **Sí**; pago, descarga y geobloqueo en blanco salvo que apliquen.
   - Tras la aprobación: **cambiar la contraseña del usuario de prueba** (viaja en claro en el envío) y **probar con un perfil sin rol** en otro navegador: el diálogo de Facebook Login for Business tiene que abrir.
2. **Comprueba el acceso avanzado** en los tres permisos (ninguno en "Listo para prueba") y que la app siga **Publicada**.
3. **Primer cliente real**: él abre tu Embedded Signup, elige **su** portafolio (nunca el tuyo), acepta permisos, verifica el número, define el PIN de dos pasos y añade su **método de pago** en su WABA. Tú recibes `waba_id` + `phone_number_id`, suscribes y registras. Un cliente = su portafolio = su WABA.
4. **Coexistence** (el cliente conserva su app de WhatsApp Business): aparece cuando eres Tech Provider, tu código manda `featureType: "whatsapp_business_app_onboarding"` + `sessionInfoVersion: "3"` con un ajuste creado como *Registro insertado de WhatsApp*, **y** la app está suscrita en *WhatsApp → Configuración → Campos de webhook* a `account_update`, `history`, `smb_app_state_sync` y `smb_message_echoes` (además de `messages`). Para portafolios externos exige el acceso avanzado. El código va en `whatsapp-saas-meta-infra`.
5. **Otros casos de uso** (Instagram, Messenger, API de conversiones): se agregan después; al enviarlos, WhatsApp aparece como "renovación" y no hay que volver a grabar videos.
6. **Access Verification** (verificación del acceso como proveedor de tecnología, ~5 días) y **Comprobación del uso de datos** (anual): están en *Información básica → Portfolio comercial*. Ponlos en el calendario.

## Plantilla: instrucciones para el revisor (`public_profile`)

Rellena con los datos del usuario; cambia los rótulos por los de **su** interfaz, literales.

```text
Platform: Website — https://URL-DE-REVISION

APP-NAME is a multi-tenant WhatsApp CRM (Tech Provider). Our customers
connect their own WhatsApp Business Account through Embedded Signup, which
runs on Facebook Login for Business. public_profile is granted by default by
that login dialog; we do not read, store or display any profile data. We use
whatsapp_business_management to access the WABA and phone number the customer
selects, and whatsapp_business_messaging to send and receive messages for it.

The interface is in Spanish; the labels below are shown exactly as they appear.

Steps to test:
1. Open https://URL-DE-REVISION and sign in with the test account below.
2. Click "Configuración" in the menu (it opens the WhatsApp settings page).
3. In the card "Tu WhatsApp, conectado con Meta", type any 6-digit PIN
   (e.g. 123456) in "PIN de verificación en dos pasos del número".
4. Click "Conectar con Meta". Allow pop-ups if the browser blocks them.
5. The Facebook Login for Business / Embedded Signup dialog opens. Select or
   create a business, a WhatsApp Business Account and a phone number, and
   grant the requested permissions.
6. When the dialog closes, the page shows "WhatsApp conectado".

Test credentials (application account, not a Facebook account):
Email: TEST-USER-EMAIL
Password: TEST-USER-PASSWORD
```

Nunca escribas la contraseña real en el chat: que el usuario la pegue directamente en el formulario de Meta.

## Cierra la bitácora

En `docs/meta/bitacora-app-review.md`: fecha de envío, fecha de resolución, días reales, textos usados, videos usados y cualquier cosa que Meta dijera literal. Con dos o tres casos propios tienes un histórico que vale más que cualquier guía.
