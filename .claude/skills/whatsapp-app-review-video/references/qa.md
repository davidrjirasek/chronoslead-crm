# QA antes de subir a Meta

Corre `revisar` sobre cada video, abre la hoja de contacto (`<video>.hoja.jpg`) y marca todo:

## Técnico

- [ ] `audio: sin audio (OK)`
- [ ] Resolución ≥ 1080 de alto (el script entrega 1920×1200)
- [ ] Duración entre ~60 y ~120 s
- [ ] Nombre de archivo que diga el permiso: `…-management-….mp4` y `…-messaging-….mp4`

## Contenido probatorio

- [ ] **Management:** se ve la lista de plantillas leída de la WABA, la creación de una plantilla nueva y la plantilla en la lista con el estado que devuelve Meta
- [ ] **Messaging:** se ve la plantilla aprobada enviada desde el SaaS **y recibida en el teléfono**; idealmente también el entrante en la bandeja y la respuesta entregada
- [ ] La apertura muestra el popup de Meta (Embedded Signup) y la tarjeta del número conectado con WABA ID y Phone Number ID
- [ ] El número de la info del contacto en WhatsApp es **el mismo** que el conectado en el SaaS

## Rótulos

- [ ] Todos en inglés, legibles, sin tapar la interfaz
- [ ] Ningún rótulo anticipa un estado que no se ve
- [ ] El token de usuario del sistema se declara si el número se conectó así
- [ ] La tarjeta inicial dice el nombre exacto del permiso

## Privacidad

- [ ] Ningún token, App Secret, PIN, OTP, contraseña ni dato de pago en pantalla, **ni un cuadro**
- [ ] Sin autocompletados de correo ni avisos de "guardar contraseña"
- [ ] Listas de chats y teléfonos de terceros difuminados
- [ ] Sin pestañas o notificaciones con información personal

## Coherencia con el formulario

- [ ] El texto de cada permiso describe los mismos pasos, en el mismo orden, que su video
- [ ] Cada permiso lleva **su** video: no el mismo archivo en los dos
- [ ] Guarda los dos MP4 y `LEEME-entrega.txt` junto a la bitácora del envío
