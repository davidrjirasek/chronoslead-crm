# Ficha del SaaS (los datos que alimentan todo)

Se llena **una vez** y de ahí salen todos los campos del panel, los textos del envío y la gestión de datos. Guárdala en `docs/meta/ficha-saas.md`. **Nunca** incluyas App Secret, tokens, PIN ni contraseñas: solo nombres de variables.

| Dato | Ejemplo | Cómo validarlo |
|---|---|---|
| Nombre del producto | `Mi SaaS` | Es el "Nombre para mostrar" de la app y lo que ve el cliente al autorizar |
| Dominio principal | `tudominio.com` | Sin `https://` ni rutas. Cubre subdominios |
| URL del espacio de revisión | `https://review.tudominio.com` | Debe abrir en incógnito y permitir iniciar sesión |
| Correo de contacto | `contacto@tudominio.com` | Del dominio propio; Meta desconfía de Gmail/Hotmail |
| Política de privacidad | `https://tudominio.com/privacy` | Ábrela: 200, rápida, y **habla de los datos de WhatsApp** |
| Condiciones del servicio | `https://tudominio.com/terms` | 200 |
| Eliminación de datos | Callback `https://tudominio.com/api/meta/data-deletion` o página de instrucciones | El callback evita el bug de "URL no válida" |
| Ícono | PNG **exactamente** 1024×1024, sin transparencia | Meta bloquea el envío si no es ese tamaño |
| Categoría de la app | `Bots de Messenger para empresas` (o `Mensajes`) | Obligatoria para enviar |
| Razón social exacta | `{{RAZON_SOCIAL_EXACTA}}` (p. ej. `Estudio Ámbar S.A. de C.V.`) | **Copiada literal** del portafolio verificado (Información del negocio → razón social) |
| País del responsable | `México` | El del portafolio |
| ¿Opera en la UE? | sí/no | Si sí, hay que llenar el delegado de protección de datos (RGPD) con los datos legales |
| Proveedores con acceso a datos | Hostinger (VPS, EE. UU.), Cloudflare (almacenamiento, EE. UU.), OpenRouter (IA, EE. UU.) | Nombre **legal** de cada empresa + categoría + país. Ver referencia 04 |
| ¿IA en el producto? | sí/no, y con qué proveedor | Si el negocio pone su propia llave, se declara como condicionado |
| Modelo de negocio | SaaS multi-tenant / agencia | Cambia el texto del envío y la arquitectura declarada |
| App ID / WABA ID / Phone Number ID | números | Públicos por diseño; anótalos para la bitácora |
| Nombres de variables de entorno | `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`… | Solo los nombres |

## Preguntas para el usuario (solo las que no puedas contestar leyendo su repo)

1. ¿Con qué **razón social exacta** está verificado tu portafolio? Ábrelo y cópiala literal, sin corregir mayúsculas ni abreviaturas.
2. ¿Qué dominio y qué URL va a ver el revisor?
3. ¿Ya tienes publicadas privacidad, términos y eliminación de datos? Pásame las URLs.
4. ¿Dónde vive tu SaaS (VPS/hosting), dónde la base de datos, dónde los archivos y qué proveedor de IA usas? Necesito el **nombre legal** y el país de cada uno.
5. ¿El producto es multi-tenant (varios negocios en tu infraestructura) o cada cliente en su propio servidor?
6. ¿Tienes ya un número conectado para probar y grabar? ¿Es el número de prueba de Meta?
7. ¿Tú o tus clientes operan en la Unión Europea?

## Señales de alarma que debes levantar de inmediato

- La razón social del formulario **no** coincide con la del portafolio verificado → se corrige antes de enviar.
- La política de privacidad no menciona WhatsApp/Meta ni los proveedores → se reescribe.
- El correo de contacto es de Gmail → se crea uno del dominio.
- Algún proveedor está en China → funciona, pero añade fricción en la revisión; si se puede, se evita durante el envío (ver referencia 04).
- El portafolio o alguna WABA tienen restricciones activas → primero se apela; un portafolio restringido contamina todo lo que cuelga de él.
