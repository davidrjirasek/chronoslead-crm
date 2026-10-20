# Espacio de revisión con el número de prueba (antes del acceso avanzado)

## Por qué existe

Hasta que Meta aprueba `whatsapp_business_messaging` y `whatsapp_business_management` en **acceso avanzado**, Embedded Signup no conecta números de clientes externos: el paso del número devuelve `#2655111` ("La app de socio no tiene los permisos avanzados…"). Para grabar los videos de App Review y probar el SaaS de punta a punta se usa la **cuenta de WhatsApp de prueba (Test WABA)** que Meta asigna al portafolio dueño de la app, con su **número de prueba**, conectada **por detrás** con un **token de usuario del sistema**. El acceso estándar sí cubre esos activos propios.

## Pasos en Meta (los hace el usuario; tú le das la ruta)

1. **Número de prueba y destinatario.** Meta for Developers → tu app → WhatsApp → *Configuración de la API*: elige el número de prueba y, en *Para*, **agrega su teléfono personal** como destinatario permitido (hasta 5). Enviar a números sin consentimiento es una bandera roja.
2. **Usuario del sistema.** Configuración del negocio (Business Suite) → *Usuarios del sistema* → *Añadir* → rol **Admin**. Si Meta dice que ya se alcanzó el límite de administradores, **reutiliza** el que ya existe.
3. **Asignar activos** a ese usuario del sistema: la **app** (control total) y la **cuenta de WhatsApp de prueba** (control total). Sin la WABA asignada, el token no la puede operar.
4. **Generar identificador (token):** elige la app; caducidad *Nunca* (o temporal si es solo para grabar); permisos `whatsapp_business_management` y `whatsapp_business_messaging`. Se copia **fuera de cámara** directo al `.env` o al panel de despliegue, nunca al chat.
5. **IDs:** WABA ID y Phone Number ID en *Configuración de la API*. El WABA ID también aparece en la URL de WhatsApp Manager como `asset_id=`.
6. **Plantilla:** `hello_world` (en_US) viene aprobada. Opcional: una plantilla propia UTILITY aprobada con 24 h de margen.

## Script de arranque (lo escribes tú en el repo del usuario)

Lee **solo** del entorno, cifra antes de guardar y nunca imprime secretos. Secuencia:

```text
1. GET  /{PHONE_NUMBER_ID}?fields=display_phone_number,verified_name      (token de sistema) -> ¿responde?
2. GET  /{WABA_ID}/phone_numbers ...                                       -> el número pertenece a la WABA
3. Guardar credenciales cifradas en el tenant de revisión (slug p. ej. "meta-review")
4. POST /{APP_ID}/subscriptions   (token de app APP_ID|APP_SECRET)          -> object=whatsapp_business_account,
        callback_url=<URL del tenant>, verify_token=<token del tenant>, fields=messages,message_template_status_update,account_update
5. POST /{WABA_ID}/subscribed_apps  subscribed_fields=messages             -> success
6. POST /{WABA_ID}/subscribed_apps  override_callback_uri=<URL del tenant>, verify_token=<token>  -> success
7. GET  /{WABA_ID}/message_templates?fields=name,status                    -> ¿hello_world APPROVED?
8. GET  /{WABA_ID}/subscribed_apps                                         -> ¿aparece APP_ID?
9. GET  <URL del tenant>?hub.mode=subscribe&hub.verify_token=…&hub.challenge=xyz  -> "xyz"
10. Imprimir resumen sin secretos: tenant, últimos 4 del número, nº de plantillas, hello_world aprobada, app suscrita, handshake OK
```

Protege el script para que **solo** corra contra el entorno de desarrollo o revisión, por ejemplo verificando el dominio en `APP_BASE_URL`.

## Luego

1. **Publica la app** (*Publicar* en el menú de la app). Sin eso no llegan los webhooks de mensajes.
2. Prueba en vivo: "Hola" desde el teléfono permitido → aparece en la bandeja → responde → llega. Envía `hello_world` → llega.
3. Eso deja en verde, además, el requisito "llamadas de prueba a la API" de *Uso permitido*.
4. En la UI del tenant de revisión, "Conectar con Meta" debe poder abrir el popup aunque ya haya número. El video lo necesita.
5. En los textos de App Review se declara: *"the test number was connected server-side by our backend using a System User access token"*.

## Si la Test WABA está desactivada o restringida

Pasa en portafolios con bloqueos previos por políticas (caso de la comunidad, 11-sep-2026). Sin Test WABA no hay número de prueba. Alternativa:

1. Consigue un **número nuevo** (SIM sin WhatsApp).
2. En Configuración del negocio → *Cuentas de WhatsApp* → *Crear cuenta*, crea una WABA en **tu** portafolio y agrega y verifica el número (SMS o llamada).
3. Asígnala al usuario del sistema y repite el arranque con ese WABA ID y Phone Number ID.
4. Regístralo con PIN (`POST /{phone_id}/register`) si queda pendiente, y agrega un método de pago a esa WABA para enviar plantillas.
5. Es un número de **producción**: la app debe estar publicada para recibir sus webhooks.

Si además de la Test WABA el portafolio tiene restricciones de política, primero apela. Un portafolio restringido contamina todo lo que cuelga de él.
