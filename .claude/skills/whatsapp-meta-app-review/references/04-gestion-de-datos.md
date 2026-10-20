# Gestión de datos

El último formulario antes de enviar. Es declarativo: Meta quiere saber **quién** toca los datos que te comparte y **qué políticas** tienes. No hay trampa, pero sí dos formas de tropezar: declarar lo que no coincide con tu política de privacidad, y dejar las políticas en blanco.

## 1. "¿Hay encargados del tratamiento de datos?"

En cristiano: ¿qué plataformas, propias o de terceros, pueden acceder a los datos que Meta te entrega?

- **SaaS centralizado** → **Sí**. Declara hosting/VPS, base de datos gestionada, almacenamiento de archivos, y el proveedor de IA si el contenido de los mensajes pasa por él.
- **Agencia con todo en la infraestructura del cliente** → normalmente **No**, y el responsable es cada cliente. Fue la respuesta de un envío aprobado en 2025.

Por cada proveedor:

| Campo | Qué poner |
|---|---|
| Nombre del encargado | **Nombre legal** de la empresa (`Hostinger International Limited`, `Cloudflare, Inc.`, `OpenRouter, Inc.`), no la marca comercial |
| Categoría | `Soluciones y servicios de TI` para infraestructura; usa otra solo si de verdad aplica |
| País | Donde procesa los datos |

Si el negocio activa la IA con **su propia llave**, decláralo igual y dilo condicionado en tu política de privacidad ("solo si el negocio activa…").

### El tip de los proveedores chinos

Meta pone más trabas cuando aparecen proveedores en China (VPS, modelo de lenguaje o base de datos). **No es rechazo automático**: hay un envío aprobado al primer intento declarando cuatro LLM, uno chino. Pero si puedes evitarlos durante la revisión, el trámite es más liso. Migrar después es válido: lo que no vale es declarar algo distinto de lo que usas.

## 2. Responsable de los datos

- **Nombre**: la **razón social exacta** con la que está verificado el portafolio. Si es persona física con actividad empresarial, el nombre de la persona (no la marca). Ábrelo y cópialo literal.
- **País**: el del portafolio.

Este campo es el que más veces está mal: la gente escribe su marca. Si no coincide con la verificación del negocio, la solicitud pierde coherencia.

## 3. "¿Has proporcionado datos personales a autoridades públicas en los últimos 12 meses?"

Responde la verdad. En la práctica, para un SaaS nuevo es **No**.

## 4. "¿Qué políticas has implementado?"

**No lo dejes en blanco**: es motivo de rechazo. Marca las que describen lo que de verdad haces, normalmente todas las de esta familia:

- Revisión de la legalidad de las solicitudes que recibes.
- Disposiciones para impugnar las solicitudes que no consideres legítimas.
- Minimización de datos al responder una solicitud.
- Documentación de las solicitudes recibidas y de tu respuesta.

**No marques** la casilla de "la legislación o la política de mi empresa nos prohíben responder".

Si no tienes esas políticas escritas, escríbelas **antes** de marcarlas: una página, en tu repositorio o en tu sitio, diciendo qué haces si te llega un requerimiento. Marcar una casilla de algo inexistente es declarar en falso, y Meta la puede pedir en el cuestionario anual de protección de datos.

## 5. Coherencia

Antes de enviar, comprueba que estas tres cosas dicen lo mismo:

1. La lista de proveedores del formulario.
2. La sección de proveedores de tu **política de privacidad publicada**.
3. Lo que de verdad corre en producción.

## 6. Lo que viene después (no bloquea el envío)

A las apps con acceso avanzado Meta les pide el **Data Protection Assessment**, con plazo y pérdida de acceso si no se responde, y la **Comprobación del uso de datos** es **anual**. Pide políticas escritas y evidencia (cifrado de secretos, TLS, MFA, revisión de accesos, parches, canal de reporte de vulnerabilidades). Anótalo en el calendario del usuario el día del envío.
