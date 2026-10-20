# Plantillas y envío

Todo con el **token del tenant** (el que devolvió el canje, o el de usuario del sistema en el espacio de revisión) y la versión de Graph vigente.

## Listar plantillas

```http
GET /{waba_id}/message_templates?fields=name,status,category,language,components&limit=100
```

Guarda una copia local para pintar la UI rápido, pero ofrece un botón **Sincronizar** que vuelve a consultar: el estado lo cambia Meta, no tú.

## Crear plantilla

```http
POST /{waba_id}/message_templates
{
  "name": "seguimiento_cita",            // minúsculas, números y _ ; único por WABA
  "language": "es_MX",
  "category": "UTILITY",                 // UTILITY | MARKETING | AUTHENTICATION
  "components": [
    { "type": "BODY",
      "text": "Hola {{1}}, te recordamos tu cita con nosotros a las {{2}}. Gracias por tu visita.",
      "example": { "body_text": [["Ana", "10:30"]] } }
  ]
}
```

- Las variables van **numeradas y en orden** (`{{1}}`, `{{2}}`), sin saltos. Si el cuerpo tiene variables, `example` es obligatorio o Meta rechaza la creación.
- `UTILITY` para seguimiento de una transacción o cita; `MARKETING` para promoción; Meta puede recategorizar.
- Responde `{ id, status: "PENDING", category }`. El estado final llega por el webhook `message_template_status_update` y también se puede consultar.
- Para el video de App Review: crear una plantilla **real** y mostrar el estado que devuelve Meta es lo que prueba `whatsapp_business_management`.

## Enviar una plantilla (fuera o dentro de la ventana)

```http
POST /{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "to": "5215512345678",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": { "code": "en_US" },
    "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "Ana" }] }]
  }
}
```

## Enviar texto libre (solo con la ventana de 24 h abierta)

```http
POST /{phone_number_id}/messages
{ "messaging_product": "whatsapp", "to": "5215512345678", "type": "text", "text": { "body": "Claro, te ayudo." } }
```

- La ventana la abre **el cliente** al escribir; dura 24 h desde su último mensaje. Fuera de ella, solo plantillas.
- Contacto sin teléfono (BSUID): el teléfono va en `to` y el BSUID en `recipient`. Mandar el BSUID en `to` devuelve `131026`.
- La respuesta trae `messages[0].id` y `message_status: accepted`: eso **no** es entregado. El estado real llega por webhook.

## Número de prueba

- Solo envía a los **destinatarios permitidos** que registraste en *Configuración de la API* (máx. 5).
- `hello_world` (en_US) ya viene aprobada.
- No lo uses para mensajear a clientes reales: es una vía conocida de restricción del portafolio.

## Errores frecuentes al enviar

| Código | Qué significa | Qué hacer |
|---|---|---|
| `190` | Token inválido o caducado | Reconectar el tenant (o regenerar el token de sistema) |
| `100` | Parámetro inválido | Revisa `phone_number_id`, nombre e idioma de la plantilla |
| `131026` | Mensaje no entregable | Destinatario sin WhatsApp, no permitido, o BSUID enviado en `to` |
| `131047` | Fuera de la ventana de 24 h | Envía una plantilla aprobada |
| `132000` / `132001` | Parámetros que no cuadran / plantilla inexistente | Compara variables y idioma exactos con la plantilla aprobada |
| `133010` | Número no registrado | Ejecuta `POST /{phone_number_id}/register` con el PIN |

Ante cualquier otro código, consulta la lista oficial de errores de Cloud API antes de suponer: los subcódigos cambian.

## Multimedia

Entrantes: el webhook trae `id` del medio; descarga con `GET /{media_id}` (devuelve una URL temporal que se pide con el mismo token) y guarda el binario en tu almacenamiento. Hazlo al recibir el webhook, no de forma perezosa: la URL caduca.
