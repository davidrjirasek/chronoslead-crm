# Rechazos y casos reales

## La causa nº 1 de rechazo: el video no demuestra el permiso

Texto literal de un rechazo (apartado 1.6, "Crear un producto de confianza"):

> *"el caso de uso de tu aplicación está permitido; sin embargo, la captura de vídeo… no muestra la experiencia completa del caso de uso"*
> *"your submitted screencast didn't showcase the functionality or usage of the requested permission as you mentioned in your use case details."*

Ese video mostraba **solo** el onboarding: conectar el número, el OTP y los IDs. El caso de uso era válido; falló únicamente la prueba en video.

**Regla:** `management` = crear/gestionar una plantilla. `messaging` = un mensaje que **llega** al WhatsApp del destinatario. Conectar el número no demuestra ninguno de los dos.

## Otros motivos documentados

| Motivo | Cómo se evita |
|---|---|
| Pedir permisos "por si acaso" | Solo los dos de WhatsApp; `public_profile` en un 2.º envío el mismo día de la aprobación |
| Política de privacidad caída, lenta o que no habla de WhatsApp | Ábrela antes de enviar |
| Datos del formulario que no coinciden con la verificación del negocio | Razón social copiada literal del portafolio |
| Setup incompleto (sin webhooks, sin activos, sin número) | La puerta de verificación en vivo antes de grabar |
| Políticas de datos en blanco | Marca las que de verdad tienes, escritas |

## Cinco envíos reales

| Caso | Modelo | Embedded Signup en el video | Evidencia de management | Evidencia de messaging | Resultado |
|---|---|---|---|---|---|
| Agencia (nov-2025) | n8n por cliente | **No aparece** | Plantilla creada en WhatsApp Manager sobre la Test WABA | `hello_world` enviada por n8n y recibida en WhatsApp Web | Aprobado al 1.er intento (~2 días) |
| SaaS de suscripciones (mar-2026) | SaaS centralizado | **Solo** el onboarding | Ninguna | Ninguna | **Rechazado** |
| El mismo, reenviado | SaaS centralizado | Sí, con "Sandbox Business" | Plantilla creada y estado leído | Plantilla enviada y recibida | Aprobado (~6 días) |
| SaaS de un cliente (jun-2026) | SaaS centralizado | Sí, número nuevo completo | Plantilla creada → en revisión → aprobada | Entrante, respuesta entregada y plantilla enviada. **Token de sistema declarado** | Aprobado al 1.er intento |
| CRM multi-tenant de la comunidad (jun-2026) | SaaS centralizado | Sí, portafolio + OTP | Plantilla creada y sincronizada | Entrante por webhook, respuesta con imagen, plantilla fuera de ventana | Aprobado al 1.er intento (~20 días) |

Lecturas:

- **Embedded Signup no es obligatorio en el video** si el uso queda inequívoco y el envío server-to-server se declara. Conviene que aparezca **como consentimiento**, no como prueba.
- **El video pesa más que el texto.** Un envío aprobado llevaba los textos de los dos permisos intercambiados y otro declaraba cuatro LLM, uno chino. Ninguna de las dos cosas tumbó la solicitud. Corrígelas igual: sobreviven al descuido, no son el patrón.
- **El responsable puede ser una persona física** si así está verificado el portafolio.

## Si te rechazan

1. Copia el motivo **literal** (con el apartado que cita) a la bitácora. La captura, no el texto que alguien te dicte: un modelo puede alucinar un motivo con formato de Meta.
2. Traduce el motivo a **qué prueba faltó**, no a "no les gustó".
3. Arregla **primero el video**; después los textos.
4. Reenvía con la misma app. No hay cooldown documentado ni hace falta una app nueva; un rechazo formal no quema la solicitud.
5. Si el motivo es genérico o incoherente con lo enviado, abre un ticket de soporte directo (en inglés) con App ID, fecha de envío y el motivo recibido.
