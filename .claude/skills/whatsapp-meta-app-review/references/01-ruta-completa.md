# La ruta completa por el panel de Meta

Orden real de trabajo. Una pantalla por turno; en cada **punto de control** pide confirmación o captura antes de seguir.

## 1. Crear la app

Meta for Developers → *Mis aplicaciones* → **Crear aplicación**.

- **Nombre**: el del producto.
- **Caso de uso**: solo **"Conectar en WhatsApp"**. Nada de Instagram o Messenger "de una vez": Meta aplica minimización de datos y cada permiso extra es riesgo de rechazo. Los demás casos de uso se agregan después, y entonces WhatsApp solo se "renueva" con un par de clics.
- **Portafolio comercial**: el que ya está **verificado** y es tuyo.

🔎 **Punto de control:** en el panel aparece el checklist con "Verificación de la empresa" en verde.

## 2. Hazte socio (el camino de Tech Provider)

*Casos de uso → Personalizar → Información general* ofrece **"Integrar con API"** (un negocio con su propio número) y **"Hazte socio"** (operar los números de tus clientes). Elige **Hazte socio**.

- **Paso 1 · Probar**: útil, se hace más adelante con el número de prueba.
- **Paso 2 · Configuración de producción**: dice literalmente *"No es obligatorio para los socios"*. Sáltalo.
- **Paso 3 · Verificación de la empresa**: ya está.
- **Hacerte proveedor de tecnología**: ábrelo. Ahí viven "Iniciar revisión de la aplicación" y el registro insertado alojado por Meta.

> Si tu panel se ve distinto al de otro miembro, no te preocupes: Meta tiene dos variantes de la interfaz interna del caso de uso. El menú lateral de la app es idéntico en las dos.

## 3. Información básica (bloqueante)

*Configuración de la aplicación → Información básica* (menú lateral, hasta abajo). **No** la del caso de uso.

Campos: nombre para mostrar, espacio de nombres, dominios de la app (sin `https://`), correo de contacto del dominio, **URL de política de privacidad**, condiciones del servicio, **eliminación de datos** (callback o instrucciones), **ícono 1024×1024**, **categoría**, delegado de protección de datos si opera en la UE, y *Añadir plataforma → Sitio web* con la URL del producto.

- El **App Secret** se trata como contraseña: al `.env`, nunca al chat.
- Bug conocido: el campo de instrucciones de eliminación puede decir "URL no válida"; cambiar a *URL de devolución de llamada* lo resuelve.

🔎 **Punto de control:** guardar sin errores. Si más adelante Meta dice *"Currently ineligible for submission"*, falta algo de esta pantalla (normalmente ícono, privacidad o categoría).

## 4. Facebook Login for Business → Configuración

Interruptores: *Inicio de sesión de OAuth con cliente* **Sí** · *OAuth web* **Sí** · *Forzar reautenticación* **No** · *Modo estricto para URI de redireccionamiento* **Sí** · *Aplicar HTTPS* **Sí** · *Inicio de sesión de OAuth con navegador integrado* **Sí** · *Iniciar sesión con el SDK de JavaScript* **Sí**.

- **URI de redireccionamiento de OAuth válidos**: la URL de la pantalla donde vive tu botón (`https://…/settings/whatsapp`).
- **Dominios permitidos para el SDK de JavaScript**: el dominio (u origen) donde se despliega el popup. Esto es lo que impide que otro despliegue tu `config_id`.
- Los webhooks de desautorización y eliminación se autocompletan desde Información básica.

## 5. Facebook Login for Business → Ajustes (aquí nace el `config_id`)

*Ajustes* ≠ *Configuración*. **Crear ajuste**, seis pasos, y **tres son irreversibles**.

> 🔴 **Embedded Signup v2 y v3 se retiran el 15-oct-2026.** La versión la decide el **ajuste**, no el código: un ajuste creado con el paso **Productos** ya es **v4**. Si tu ajuste es viejo (su asistente no tuvo paso Productos), crea uno nuevo y cambia el `config_id`. No confundir con la versión de Graph (`v25.0`, `v26.0`), que va en `FB.init` y en las URLs de la API: son relojes distintos.

> 🔴 **Regla todo-o-nada de Meta:** *"All permissions that your app asks for during login must be granted by your app user or your app won't be granted any permissions."* Cada producto que marques auto-selecciona sus permisos. Si uno de ellos no tiene **acceso avanzado**, un cliente externo no puede concederlo y tu app se queda **sin ningún permiso**, incluidos los de WhatsApp. El onboarding completo se rompe, no solo esa función.

| Paso | Valor | ¿Irreversible? |
|---|---|---|
| Nombre | Descriptivo, máx. 30 caracteres (`Embedded <Producto> Sep26`) | No |
| Variación de inicio de sesión | **Registro insertado de WhatsApp** | 🔴 Sí |
| Productos | *WhatsApp Cloud API* (fijo) + *API de mensajes de marketing* (déjala: usa los mismos dos permisos y evita re-onboardear después). *Conversions API for Business Messaging → WhatsApp* **solo** si ya tienes `whatsapp_business_manage_events` en avanzado. **No** marques *Click to WhatsApp / Direct / Messenger Ads* sin `ads_management`, `ads_read` y `pages_*` en avanzado (ver regla todo-o-nada) | 🔴 Sí |
| Identificador de acceso | Caducidad **Nunca** (60 días desconecta a tus clientes) | 🔴 Sí |
| Activos | *Cuentas de WhatsApp*. Permisos de tarea: `MANAGE_TEMPLATES`, `VIEW_TEMPLATES`, `VIEW_PHONE_ASSETS`, `MANAGE_PHONE_ASSETS`, `MESSAGING`. Con Conversions API **no** marques *Píxeles*: el dataset cuelga de la WABA (`POST /{WABA_ID}/dataset`) y el píxel solo agrega una pantalla al cliente | Editable, pero los clientes ya incorporados conservan los permisos que concedieron |
| Permisos | Los que auto-marca cada producto (los dos de WhatsApp; + `whatsapp_business_manage_events` si marcaste Conversions API). No agregues ninguno más | No |

Si dejas los permisos de tarea vacíos, Meta asigna **MANAGE** (control total) por defecto: pides más de lo necesario.

🔎 **Punto de control:** copia el **Identificador del ajuste** (`config_id`) al `.env` del SaaS (`META_CONFIG_ID`).

## 6. Número de prueba, destinatario y token de usuario del sistema

Es el camino que **siempre** funciona antes del acceso avanzado. Detalle en `whatsapp-saas-meta-infra → references/tenant-de-revision.md`. Resumen:

1. *WhatsApp → Configuración de la API*: número de prueba y **agrega tu teléfono** como destinatario permitido.
2. Business Suite → *Usuarios del sistema* → uno con rol **Admin** (si dice que llegaste al límite, reutiliza el existente).
3. **Asignar activos**: la app y la cuenta de WhatsApp de prueba, control total.
4. **Generar identificador** con los dos permisos de WhatsApp. Va directo al `.env`.
5. Copia **WABA ID** y **Phone Number ID**.

🔎 **Punto de control:** desde el SaaS entra un "Hola" y sale una respuesta, con la app **publicada**.

## 7. Publicar la app

Menú lateral → **Publicar**. No requiere App Review y es lo que permite recibir webhooks de mensajes. El panel avisa: *"Las aplicaciones solo podrán recibir webhooks de prueba… mientras esta no esté publicada"*.

## 8. Dejar solo dos permisos

*Revisión de la aplicación → Permisos y funciones*: si aparecen `public_profile` o `business_management`, **suprímelos** de la solicitud. Deben quedar exactamente `whatsapp_business_messaging` y `whatsapp_business_management`.

> ⚠️ Suprimirlo de **este** envío no lo borra de la app, y **sí lo necesitas**: sin `public_profile` en acceso avanzado el Embedded Signup solo abre para perfiles con rol en la app. Va en un segundo envío el mismo día de la aprobación (ver `05-despues-del-envio.md`). Prepáralo ahora.

## 9. Uso permitido (un formulario por permiso)

*Revisión de la aplicación → Enviar a revisión → Uso permitido*.

- Pide una **descripción de la empresa** para generar una sugerencia con IA. **Ese campo no acepta URLs**: quítalas. La sugerencia se descarta: se pega el texto propio (referencia 03).
- Cada permiso pide cuatro cosas: descripción, **video**, llamadas de prueba a la API y confirmar el uso permitido.
- Las llamadas de prueba se ponen en verde solas: el mensaje que enviaste en el paso 6 cubre *messaging*, y abrir el Embedded Signup cubre *management*.
- Al subir el video, **espera**: si guardas antes de que termine, el permiso no queda en verde. Vuelve a guardar.

## 10. Gestión de datos

Referencia 04. Es información, no una trampa: procesadores, responsable con razón social exacta, país, autoridades y **políticas implementadas** (no dejarlas en blanco).

## 11. Enviar

Confirmas y envías. Ya no se puede editar ni cancelar. Meta muestra un plazo de ~20 días.

🔎 **Punto de control:** estado *"Revisión en curso"* y PDF/captura del envío guardados en la bitácora.
