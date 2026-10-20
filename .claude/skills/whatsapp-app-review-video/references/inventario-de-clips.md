# Inventario de clips para App Review

Se graban **tres archivos crudos**. La apertura se graba **una sola vez** y va al inicio de los dos videos.

## A — Apertura común (va en los dos videos)

| Clip | Qué grabar | Notas |
|---|---|---|
| A01 | Barra de direcciones con la URL del **espacio de revisión** + inicio de sesión en el SaaS | Si el SaaS es multi-tenant con subdominios (`meta-review.tudominio.com`), que se lea la URL. Credenciales del SaaS, **nunca de Facebook** |
| A02 | Navegar a **Ajustes → WhatsApp** (o como se llame en tu UI) | Se ve el botón "Conectar con Meta" y la tarjeta del número conectado |
| A03 | Clic en **"Conectar con Meta"** → se abre el popup de Meta (Facebook Login for Business / Embedded Signup) | Hazlo desde un navegador con tu perfil de Facebook **admin de la app**. Con un perfil sin rol sale "Función no disponible" |
| A04 | En el popup: elegir el portafolio → **Continuar** (pantalla de permisos) | **Corta antes de cerrar el popup** y antes de teclear números u OTP. Antes del acceso avanzado no se registra un número nuevo en este video |
| A05 | La tarjeta **"Número conectado"** con WABA ID y Phone Number ID | Si los IDs se ven chicos, usa `zoom`. Es el número de prueba conectado con token de usuario del sistema |

## M — `whatsapp_business_management`

| Clip | Qué grabar | Notas |
|---|---|---|
| M01 | Lista de plantillas leída de la WABA, con sus estados (`hello_world` aprobada) | Demuestra lectura de activos |
| M02 | Crear plantilla nueva: nombre único, idioma, categoría **UTILITY**, cuerpo con variable `{{1}}` | El tecleo se acelera en la edición (`velocidad` 2–3) |
| M03 | Clic en **crear / enviar a aprobación** | Que se vea el botón y la acción |
| M04 | La plantilla nueva en la lista con el **estado que devuelve Meta** (pendiente / en revisión) | Es el remate que prueba el permiso |

## S — `whatsapp_business_messaging`

| Clip | Qué grabar | Notas |
|---|---|---|
| S00 | En WhatsApp (Web o teléfono), la **info del contacto del negocio** con el número de prueba | Prueba que es **el mismo número** conectado al SaaS |
| S01 | Desde tu teléfono (destinatario permitido) envías "Hola" al número de prueba | Difumina la lista de chats de WhatsApp Web |
| S02 | El mensaje **entra a la bandeja** del SaaS (webhook) | Verifica antes de grabar que los webhooks llegan (app publicada) |
| S03 | Respondes desde la bandeja con texto libre | Ventana de 24 h abierta. Acelera el tecleo |
| S04 | La respuesta **llega** a tu WhatsApp | Difumina chats de terceros |
| S05 | Envías una **plantilla aprobada** (`hello_world`) desde el SaaS | Mensaje iniciado por el negocio |
| S06 | La plantilla aparece en la bandeja con su estado (`sent`, `delivered`…) | El rótulo repite el estado que se ve |
| S07 | La plantilla **llega** a tu WhatsApp | Remate del permiso |

> Si los webhooks entrantes no funcionan al grabar, omite S01–S04: el video queda con plantilla enviada y recibida, que también se ha aprobado. Arreglarlo antes es mejor.

## Variante agencia (backend en n8n, sin SaaS)

Si tu Tech Provider es **agencia** (cada cliente en su propia infraestructura y el backend es n8n), el patrón aprobado en nov-2025 fue:

- **Messaging:** el workflow de n8n abierto en **tu dominio**, nodo HTTP a `graph.facebook.com/.../messages` con `hello_world`, ejecutarlo y mostrar el mensaje **llegando** a WhatsApp Web desde el número de prueba. Difumina el token del header.
- **Management:** WhatsApp Manager con la **Test WhatsApp Business Account** → crear plantilla → enviarla a revisión → la lista con la plantilla nueva "En revisión".

## Reglas de grabación (dáselas al usuario)

1. **Resolución 1080p.** El script normaliza a 1920×1080. Si la interfaz se ve chica, sube el zoom del navegador a 110–125 %; Meta recomienda anchos de pantalla de 1440 px o menos para que se lea.
2. **Cursor grande** y acciones con el **ratón**, no atajos de teclado.
3. **Limpia la pantalla:** notificaciones apagadas, barra de favoritos oculta, pestañas ajenas cerradas y el gestor de contraseñas sin autocompletar. El aviso de Chrome "¿Guardar contraseña?" se recorta en la edición.
4. **Prueba el login en incógnito** antes de grabar A01.
5. **Dos segundos de margen** antes y después de cada acción. Sin hablar.
6. **Un archivo por bloque** (`A`, `M`, `S`). Es más fácil de editar que una toma larga.
7. **Nada de secretos:** no abras `.env`, paneles con tokens ni la clave secreta de la app mientras grabas.
8. Herramientas: OBS Studio (cualquier SO), `Win + Alt + R` / Recortes (Windows) o `Cmd + Shift + 5` (macOS). MKV o MP4 sirven.
