# Textos del envío (en inglés)

Cada permiso lleva **su propio** texto. Nunca el mismo pegado dos veces, nunca el de un permiso en el otro. El texto cuenta, en el **mismo orden**, lo que el video enseña.

## Qué tiene que contener cada texto

1. Para qué usa **tu producto** ese permiso, en lenguaje de producto, no de API.
2. Una lista numerada de lo que el permiso habilita dentro del SaaS (3–5 puntos).
3. El aislamiento: cada negocio ve y gestiona **solo** sus activos.
4. Qué muestra el screencast, **en orden**, con los nombres de las pantallas.
5. Si el número se conectó server-to-server con **token de usuario del sistema**, declararlo (punto 5 de la guía de screencasts de Meta).
6. Si la interfaz está en español, decir que el video lleva rótulos en inglés.
7. Consentimiento: solo se escribe a quien aceptó recibir mensajes; no se venden contactos; no hay mensajes no solicitados.

Reglas de forma: inglés; sin placeholders sin reemplazar (`[Your Name]`); sin promesas que el video no demuestre; el campo **"descripción de la empresa"** (el que genera la sugerencia con IA) **no acepta URLs**.

## Descripción corta de la empresa

```text
Multitenant WhatsApp CRM. Each business connects its own WhatsApp Business Account, manages templates and handles conversations from an isolated workspace.
```

## Descripción larga

```text
{{PRODUCT}} is a multitenant customer-communications CRM operated by {{LEGAL_NAME}} ({{COUNTRY}}). Each customer business connects and keeps ownership of its own WhatsApp Business Account and phone number through Meta's Embedded Signup. Inside its isolated workspace the business can view its connected assets, manage and create message templates, send approved templates or customer-service replies to opted-in recipients, receive customer messages, and monitor delivery status. {{PRODUCT}} never sells contact data and never sends messages on its own behalf.
```

## `whatsapp_business_management`

```text
{{PRODUCT}} uses whatsapp_business_management so that an administrator of a customer business can connect the business's own WhatsApp Business Account (WABA) through Embedded Signup and manage the WhatsApp assets that the business explicitly authorizes.

What the permission enables in the product:
1. Read the connected WABA and business phone number (display number, verified name, WABA ID, phone number ID) and show them in Settings > WhatsApp.
2. Subscribe the WABA to our webhooks so the business receives template status updates.
3. List the WABA's message templates with the status returned by Meta.
4. Create a new message template from Settings > Templates and submit it to Meta for approval, then synchronize its status.

Each business only sees and manages its own assets; workspaces are isolated by organization ID. Without this permission the business could not connect its account or manage templates from {{PRODUCT}}.

The screencast is recorded before Advanced Access, so it uses the Test WhatsApp Business Account and test phone number that Meta provides to the app. It shows, in this order: sign-in to a dedicated test workspace at {{REVIEW_URL}} with {{PRODUCT}} credentials (not Facebook credentials); the "Connect with Meta" button opening Meta's Embedded Signup dialog (Facebook Login for Business) where the business administrator selects a business portfolio and grants the permission; Settings > WhatsApp with the connected test assets and their WABA ID / phone number ID; Settings > Templates with the template list read from Meta; the creation of a real UTILITY template from {{PRODUCT}}; and the new template in the list with the status Meta returns. Because Advanced Access is not granted yet, no external business is onboarded in this recording: the test number shown was connected server-side by our backend using a System User access token, which is the same server-to-server sequence (token exchange, webhook subscription, phone registration) that runs after a real Embedded Signup. Asset management calls are performed server-side with that token, so the Meta front-end login is not visible for those API calls (App Review screencast note 5).

Note: the product UI is in Spanish. Every step in the video is annotated with English captions.
```

## `whatsapp_business_messaging`

```text
{{PRODUCT}} uses whatsapp_business_messaging so that each customer business can message people who have consented to receive WhatsApp messages from that business, and can receive their replies in the same inbox.

What the permission enables in the product:
1. Send an approved message template to start a conversation with an opted-in contact.
2. Send free-form customer-service replies inside an open 24-hour conversation window from the Inbox.
3. Receive customer messages and delivery status updates through webhooks and display them in the Inbox.
4. Register the business phone number after Embedded Signup.

Messages are always sent from the business's own phone number to its own contacts; {{PRODUCT}} never sends messages on its own behalf and never shares one business's contacts with another.

The screencast is recorded before Advanced Access, so it uses Meta's test phone number connected to a dedicated test workspace at {{REVIEW_URL}} and a real recipient phone that has opted in and is listed as an allowed recipient of the test number. It shows, in this order: sign-in with {{PRODUCT}} credentials; the "Connect with Meta" button opening Meta's Embedded Signup dialog where the business administrator selects a portfolio and grants the permission; the connected test number in Settings > WhatsApp; the customer writing to the business from their own WhatsApp; that message arriving in the {{PRODUCT}} inbox through webhooks; a customer-service reply sent from the inbox and delivered to the phone; the approved hello_world template being sent from {{PRODUCT}}; the outgoing template in the inbox with the status reported by Meta; and the template received in the recipient's WhatsApp. Because Advanced Access is not granted yet, the test number was connected server-side by our backend using a System User access token, and messages are sent server-side with that token, so the Meta front-end login is not visible for those API calls (App Review screencast note 5).

Note: the product UI is in Spanish. Every step in the video is annotated with English captions.
```

## Variante agencia (cada cliente en su propia infraestructura, backend en n8n)

Cambia dos cosas:

- **Arquitectura declarada:** *"Each customer business runs its own isolated automation instance on infrastructure that the customer owns; {{LEGAL_NAME}} operates it on their behalf."* Eso es lo que hace coherente responder "sin procesadores" en la gestión de datos cuando de verdad no hay backend centralizado.
- **Qué enseña el video:** el workflow en **tu dominio** enviando la plantilla por la Cloud API y el mensaje **llegando** a WhatsApp Web (messaging); WhatsApp Manager creando la plantilla sobre la Test WABA (management).

## Antes de pegar

- [ ] ¿El texto cuenta los mismos pasos, en el mismo orden, que el video de **ese** permiso?
- [ ] ¿Menciona el token de usuario del sistema si así se conectó el número?
- [ ] ¿Está en inglés y sin placeholders?
- [ ] ¿Ningún dato contradice la política de privacidad publicada?
- [ ] Guarda ambos textos en `docs/meta/textos-app-review.md` para el reenvío y para el siguiente cliente.
