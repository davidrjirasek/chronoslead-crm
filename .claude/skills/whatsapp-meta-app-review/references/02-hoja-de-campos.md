# Plantilla: hoja de campos para copiar y pegar

Genera `docs/meta/hoja-de-campos.md` con **los datos reales** del usuario en lugar de los marcadores. Que pueda tenerla al lado del navegador y avanzar sin volver a preguntarte nada.

---

# Hoja de campos · {{PRODUCTO}} · Meta Tech Provider

> Generada el {{FECHA}}. Los secretos **no** están aquí: viven en `.env` / el panel de despliegue.
> Marca cada casilla al pegarla.

## 1. Crear aplicación

- [ ] Nombre de la aplicación: `{{PRODUCTO}}`
- [ ] Caso de uso: **Conectar en WhatsApp** (solo ese)
- [ ] Portafolio comercial: `{{PORTAFOLIO_VERIFICADO}}`

## 2. Configuración de la aplicación → Información básica

- [ ] Nombre para mostrar: `{{PRODUCTO}}`
- [ ] Espacio de nombres: `{{SLUG}}`
- [ ] Dominios de la aplicación: `{{DOMINIO}}`
- [ ] Correo de contacto: `{{CORREO_DOMINIO}}`
- [ ] URL de la política de privacidad: `{{URL_PRIVACIDAD}}`
- [ ] URL de las condiciones del servicio: `{{URL_TERMINOS}}`
- [ ] Eliminación de datos de usuario → *URL de devolución de llamada*: `{{URL_CALLBACK_ELIMINACION}}`
- [ ] Ícono: `{{RUTA_ICONO_1024}}` (exactamente 1024×1024)
- [ ] Categoría: `Bots de Messenger para empresas`
- [ ] Añadir plataforma → **Sitio web** → URL: `{{URL_PRODUCTO}}`
- [ ] Delegado de protección de datos (solo UE): `{{NOMBRE_LEGAL}}`, `{{CORREO_DOMINIO}}`, `{{DIRECCION_LEGAL}}`
- [ ] App ID anotado: `{{APP_ID}}` · App Secret → copiado a `META_APP_SECRET` en `.env` (no aquí)

## 3. Inicio de sesión con Facebook → Configuración

- [ ] Inicio de sesión de OAuth con cliente: **Sí**
- [ ] Inicio de sesión de OAuth web: **Sí**
- [ ] Forzar reautenticación web: **No**
- [ ] Usar modo estricto para URI de redireccionamiento: **Sí**
- [ ] Aplicar HTTPS: **Sí**
- [ ] Inicio de sesión de OAuth con navegador integrado: **Sí**
- [ ] Iniciar sesión con el SDK de JavaScript: **Sí**
- [ ] URI de redireccionamiento de OAuth válidos: `{{URL_PANTALLA_CONEXION}}`
- [ ] Dominios permitidos para el SDK de JavaScript: `{{ORIGEN_HTTPS}}`
- [ ] URL de devolución de llamada de desautorización: `{{URL_CALLBACK_DESAUTORIZACION}}`

## 4. Inicio de sesión con Facebook → Ajustes → Crear ajuste

- [ ] Nombre: `Embedded {{PRODUCTO}} {{MES_AÑO}}` (máx. 30)
- [ ] Variación: **Registro insertado de WhatsApp** 🔴 irreversible
- [ ] Productos: WhatsApp Cloud API + API de mensajes de marketing 🔴 irreversible
- [ ] Caducidad del identificador: **Nunca** 🔴 irreversible
- [ ] Activos: Cuentas de WhatsApp · permisos de tarea: MANAGE_TEMPLATES, VIEW_TEMPLATES, VIEW_PHONE_ASSETS, MANAGE_PHONE_ASSETS, MESSAGING
- [ ] Permisos: `whatsapp_business_management`, `whatsapp_business_messaging`
- [ ] Identificador del ajuste copiado a `META_CONFIG_ID`

## 5. Webhooks (Casos de uso → Personalizar → Configuración)

- [ ] URL de devolución de llamada: `{{URL_WEBHOOK}}`
- [ ] Identificador de verificación: → `META_WEBHOOK_VERIFY_TOKEN` en `.env`
- [ ] Campos suscritos: `messages`, `message_template_status_update`, `account_update`

## 6. Número de prueba y token de sistema

- [ ] Destinatario permitido añadido: `{{TELEFONO_PROPIO}}`
- [ ] Usuario del sistema (Admin): `{{USUARIO_SISTEMA}}`
- [ ] Activos asignados: app `{{PRODUCTO}}` + cuenta de WhatsApp de prueba (control total)
- [ ] Token generado con los 2 permisos → `REVIEW_SYSTEM_USER_TOKEN` en `.env`
- [ ] WABA ID: `{{WABA_ID}}` · Phone Number ID: `{{PHONE_NUMBER_ID}}`

## 7. Publicar

- [ ] App publicada (menú lateral → Publicar)
- [ ] Entra un mensaje real a la bandeja y sale una respuesta

## 8. Revisión de la aplicación

- [ ] Permisos en la solicitud: solo los **dos** de WhatsApp (public_profile suprimido de ESTE envío)
- [ ] Segundo envío preparado para el día de la aprobación: plataforma Sitio web, instancia y usuario de prueba del revisor, instrucciones en inglés
- [ ] Descripción de la empresa (sin URLs): `{{DESCRIPCION_CORTA}}`
- [ ] Texto de `whatsapp_business_management`: ver `docs/meta/textos-app-review.md`
- [ ] Video de management subido: `{{ARCHIVO_VIDEO_MANAGEMENT}}`
- [ ] Texto de `whatsapp_business_messaging`: ver `docs/meta/textos-app-review.md`
- [ ] Video de messaging subido: `{{ARCHIVO_VIDEO_MESSAGING}}`
- [ ] Los cuatro requisitos en verde en cada permiso

## 9. Gestión de datos

- [ ] ¿Proveedores con acceso a datos de la plataforma?: **Sí**
- [ ] `{{PROVEEDOR_1}}` · categoría `Soluciones y servicios de TI` · país `{{PAIS_1}}`
- [ ] `{{PROVEEDOR_2}}` · … · `{{PAIS_2}}`
- [ ] Responsable de los datos: `{{RAZON_SOCIAL_EXACTA}}` · país `{{PAIS}}`
- [ ] ¿Datos a autoridades públicas en 12 meses?: `{{SI_NO}}`
- [ ] Políticas implementadas marcadas: `{{LISTA}}`

## 10. Enviar

- [ ] Confirmo y envío
- [ ] Fecha de envío: `{{FECHA_ENVIO}}` → anotada en la bitácora
- [ ] Captura del estado "Revisión en curso" guardada
