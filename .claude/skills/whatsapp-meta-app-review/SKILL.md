---
name: whatsapp-meta-app-review
description: Guía paso a paso el trámite completo para convertir una app de Meta for Developers en Tech Provider de WhatsApp, con los campos listos para copiar y pegar generados con los datos del SaaS del usuario — crear la app, Información básica, Facebook Login for Business y el ajuste (config_id), número de prueba y token de usuario del sistema, publicar la app, quitar public_profile, textos en inglés por permiso, gestión de datos, envío a revisión y qué hacer después — y diagnostica los errores del camino (#2655111, "Función no disponible", webhooks que no llegan, Test WABA desactivada) y los rechazos. ACTÍVATE con "guíame para mandar mi app a revisión", "quiero ser Tech Provider", "qué pongo en información básica / uso permitido / gestión de datos", "me salió el error de permisos avanzados", "me rechazaron el App Review" — aunque no digan "skill".
---

# Tech Provider de WhatsApp: del panel de Meta al envío a revisión

Tu trabajo es que el usuario llegue a **Submit** con todo coherente y sin sorpresas, y que salga de cada sesión con un documento suyo que pueda copiar y pegar. El trámite lo ejecuta él en su navegador; tú preparas, verificas y diagnosticas.

## Antes de nada: dónde está

Pregunta (o revisa en su repo) y sitúalo en el mapa:

| # | Hito | Cómo se comprueba |
|---|---|---|
| 1 | Portafolio comercial **verificado** | Business Suite → Seguridad → Verificación del negocio dice "Verificado" |
| 2 | App **Business** creada con el caso de uso de WhatsApp y el portafolio correcto | Panel de la app |
| 3 | **Información básica** completa (ícono 1024, privacidad, categoría…) | Si falta algo, Meta bloquea el envío con "Currently ineligible for submission" |
| 4 | Facebook Login for Business configurado + **ajuste** creado (`config_id`) | Inicio de sesión con Facebook → Configuración y → Ajustes |
| 5 | SaaS mínimo funcional y **número conectado** (el de prueba, por token de sistema) | Entra un mensaje y sale una respuesta |
| 6 | App **publicada** | Sin esto no llegan webhooks de mensajes |
| 7 | **Videos** grabados y montados | Skill `whatsapp-app-review-video` |
| 8 | Textos y **gestión de datos** | Este skill, referencias 03 y 04 |
| 9 | Enviado | Estado "Revisión en curso" |

Sin el 1 no hay nada que hacer: se resuelve primero (documento legal + comprobante de domicilio que coincidan al 100 % con lo que se escribe en el formulario). Para eso está el skill `meta-business-verification`: entrevista, audita y deja qué pegar en cada campo.

## Flujo de trabajo

1. **Ficha del SaaS.** Reúne los datos con `references/00-ficha-saas.md`. Pregunta **solo lo que falte**; lo que se pueda leer del repo (dominio, URLs legales, stack, proveedores), léelo. Guarda el resultado en `docs/meta/ficha-saas.md` del usuario. **Sin secretos.**
2. **Huecos primero.** Si no existen la política de privacidad, los términos, la página de eliminación de datos o el ícono de 1024×1024, créalos ahora (con `whatsapp-saas-meta-infra` para las páginas y los callbacks). Copiar y pegar campos que apuntan a URLs rotas es perder una vuelta de revisión.
3. **Hoja de campos.** Genera `docs/meta/hoja-de-campos.md` a partir de `references/02-hoja-de-campos.md`, ya rellenada con sus datos: pantalla por pantalla, en el orden en que Meta las pide, con casillas para marcar.
4. **Acompaña pantalla por pantalla** con `references/01-ruta-completa.md`. Una pantalla por turno, en el orden real. Pide confirmación (o captura) en cada punto de control antes de seguir.
5. **Cuando toque código** — botón de Embedded Signup, webhooks, número de prueba conectado, páginas legales — cambia a `whatsapp-saas-meta-infra`. Cuando toque grabar y montar, a `whatsapp-app-review-video`.
6. **Textos del envío** con `references/03-textos-app-review.md`: uno por permiso, en inglés, contando lo que el video enseña **en el mismo orden**.
7. **Gestión de datos** con `references/04-gestion-de-datos.md`.
8. **Envío y después** con `references/05-despues-del-envio.md`.
9. **Si algo falla** o llega un rechazo: `references/06-troubleshooting.md` y `references/07-rechazos-y-casos.md`.
10. **Bitácora.** Mantén `docs/meta/bitacora-app-review.md` con fechas, App ID, WABA ID, qué se envió y qué respondió Meta, literal. Es lo que hace rápido el siguiente intento y el siguiente cliente.

## Reglas

- **Nunca pidas secretos por chat.** App Secret, tokens, PIN y OTP van del panel de Meta al `.env` o al gestor de secretos del usuario, sin pasar por la conversación. Si el usuario los pega, dile que los rote.
- **Solo dos permisos**: `whatsapp_business_messaging` y `whatsapp_business_management`. `public_profile` va en un **segundo envío, el mismo día** en que aprueben esos dos: sin él en acceso avanzado el Embedded Signup solo abre para perfiles con rol en la app y **no se puede conectar a ningún cliente**. El segundo envío **sí** pide plataforma declarada e instrucciones con usuario de prueba para el revisor (no pide video); déjalo redactado antes de la aprobación. Caso de referencia (sep-2026): 1.er envío 8 días, 2.º envío 1 h 58 min. Nada de `business_management` ni Instagram "de una vez": pedir de más es causa documentada de rechazo.
- **Coincidencia exacta.** El "responsable de los datos" es la **razón social con la que está verificado el portafolio**, no la marca. En persona física, el nombre de la persona.
- **Nada inventado.** No marques políticas que el usuario no tiene: primero se escriben (una página por política basta), luego se marcan.
- **Nada de trucos.** Ni datos falsos, ni mensajes a números sin consentimiento, ni "cuentas verificadas" compradas. Un portafolio restringido cuesta mucho más que una revisión lenta.
- **No prometas tiempos.** Meta muestra ~20 días; lo observado va de 2 a ~20. Y ser Tech Provider ≠ tener los permisos aprobados.
- Todo lo que se declara (procesadores, países, uso) debe **coincidir** con la política de privacidad publicada.

## Referencias

- `references/00-ficha-saas.md` — qué datos hacen falta y cómo validarlos
- `references/01-ruta-completa.md` — el recorrido real por el panel, pantalla por pantalla
- `references/02-hoja-de-campos.md` — plantilla de la hoja copiar/pegar
- `references/03-textos-app-review.md` — textos en inglés por permiso, con ejemplos aprobados
- `references/04-gestion-de-datos.md` — procesadores, responsable, políticas
- `references/05-despues-del-envio.md` — tiempos, estados, public_profile, primer cliente, Coexistence
- `references/06-troubleshooting.md` — síntoma → causa → solución
- `references/07-rechazos-y-casos.md` — qué rechaza Meta y cinco envíos reales
