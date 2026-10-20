# Banco de rótulos en inglés

Reglas:

- **Un rótulo por segmento**, máximo dos líneas (~150 caracteres). Para cambiar de rótulo dentro de un clip, pártelo en dos segmentos.
- Presente y descriptivo: qué pasa **y** dónde pasa ("Settings > WhatsApp: …").
- Si la UI está en español, nombra el botón entre comillas en su idioma real: *Submitting the template ("Crear y enviar a aprobación")*.
- Repite **exactamente** el estado que se ve (`sent`, `pending review`). Nunca lo anticipes.
- Si aceleraste el tecleo, dilo: *(typing sped up)*.
- Declara lo que no se ve: el número se conectó **server-side** con token de usuario del sistema.
- Cambia `ProductName`, las URLs y los nombres de menú por los de tu producto.

## Tarjetas

| Momento | `tarjeta` | `subtitulo` |
|---|---|---|
| Inicio management | `whatsapp_business_management` | Read the connected WhatsApp Business Account and manage its message templates from ProductName |
| Cierre management | `whatsapp_business_management` | Demonstrated: read WABA assets, list templates, create a template and submit it to Meta |
| Inicio messaging | `whatsapp_business_messaging` | Receive customer messages, reply from the inbox and send approved templates with Meta's test number |
| Cierre messaging | `whatsapp_business_messaging` | Demonstrated: inbound message via webhooks, reply delivered, approved template sent and received |

## Apertura (A)

- A01 · `Signing in to the dedicated test workspace at review.yourdomain.com (ProductName credentials, not Facebook)`
- A02 · `Settings > WhatsApp: the official Embedded Signup entry point and the connected test number`
- A03 · `"Connect with Meta" opens Meta's Embedded Signup dialog (Facebook Login for Business)`
- A04 · `The business administrator selects its portfolio and grants ProductName the WhatsApp permissions (no external number is registered in this pre-approval recording)`
- A05 · `Connected test WhatsApp Business Account: WABA ID and phone number ID. Pre-approval: connected server-side with a System User token`

## Management (M)

- M01 · `Settings > Templates: message templates and statuses read from the WABA`
- M02 · `Creating a new UTILITY template from ProductName: name, language, category and body with variables (typing sped up)`
- M03 · `Submitting the template to Meta for approval ("Create and submit")`
- M04 · `Template created in the WABA with the status returned by Meta: pending review`

## Messaging (S)

- S00 · `WhatsApp contact info of the business: test number +1 (555) 000-0000, the same number connected in ProductName`
- S01 · `The opted-in customer (our own WhatsApp, an allowed recipient) writes to the business's test number`
- S02 · `Inbound message received through webhooks and shown in the ProductName inbox`
- S03 · `Customer-service reply written and sent from the inbox inside the 24-hour window (typing sped up)`
- S04 · `Reply delivered to the customer's WhatsApp`
- S05 · `Sending the approved hello_world template from ProductName (business-initiated message)`
- S06 · `Outgoing template in the ProductName inbox with the status reported by Meta`
- S07 · `Template received in the customer's WhatsApp`

## Variante agencia (n8n)

- `n8n workflow on our own domain calls the WhatsApp Cloud API (POST /messages) with the approved hello_world template`
- `Template received on WhatsApp Web from the test number`
- `WhatsApp Manager > Test WhatsApp Business Account: creating a new message template`
- `The new template appears in the WABA with status "In review"`
