# 6 · Embedded Signup en multitenant

La base (FB SDK, FedCM, `config_id` de Embedded Signup v4, canje del `code`,
versión de Graph en una sola variable) está en la skill
**whatsapp-saas-meta-infra**. Aquí va solo lo que cambia con muchos tenants.
Donde se contradigan, **manda esta referencia**.

## 1. El popup vive en UN solo dominio

Meta solo devuelve el `code`, la WABA y el número a la ventana cuyo dominio
exacto está en **"Dominios admitidos para el SDK de JavaScript"**, y esa lista
**no acepta comodines**. Con el popup en `{slug}.tudominio` tendrías que dar de
alta cada subdominio nuevo a mano en la app de Meta.

Patrón (host fijo `alta.tudominio`, reservado):

1. En el tenant, con su sesión, se crea un **intento** (`signup_attempt`: id de
   256 bits, organización, usuario, caduca en 10 min, un solo uso).
2. Se manda a la persona a `https://alta.tudominio/conectar/whatsapp#a={intento}&o={slug}`.
   El intento va en el **fragmento** (`#`): el navegador no lo manda al servidor
   ni en el `Referer`, y la página lo borra de la barra al leerlo.
3. En `alta` corre `FB.login` con el `config_id`. Al terminar, el cierre
   (`POST /api/meta/embedded-signup`, que solo existe en ese host) se autentica
   con el intento: las cookies son de cada subdominio, así que en `alta` el
   intento ES la credencial.
4. Antes de guardar, revalida que ese usuario sigue pudiendo configurar esa
   organización (pudo perder el permiso en esos 10 minutos).
5. El webhook se registra con la URL **del tenant** (`{slug}.tudominio/...`), no
   con la de `alta`, para que coincida con la que el cliente ve en sus Ajustes.
6. Regresa a la persona a su subdominio con el resultado.

En "Dominios admitidos" registras solo `alta.tudominio` (y tu dominio de
desarrollo si pruebas en local por túnel).

## 2. La secuencia al cerrar el alta (WABA propia del cliente)

Tras el Embedded Signup, la WABA es la del negocio del cliente. Con el token del
negocio (canjeado del `code`):

1. `POST /{waba_id}/subscribed_apps` con `subscribed_fields=messages`.
2. `POST /{waba_id}/subscribed_apps` con `override_callback_uri` = URL del
   webhook de la organización y `verify_token` = su segmento (Meta hace el
   handshake en ese momento).
3. Si el número **ya está `CONNECTED`**, no lo registres otra vez (su PIN no
   cambia). Si no, `POST /{phone_number_id}/register` con
   `{"messaging_product": "whatsapp", "pin": "…"}`.

Suscribir antes de registrar evita que el número quede registrado mientras tu
app todavía no recibe sus eventos.

## 3. El PIN: generarlo, no pedirlo

Si el número aún no tiene verificación en dos pasos, el PIN que mandas en
`/register` **se convierte** en su PIN. Pedírselo al usuario antes del popup
solo lo obliga a inventar uno y es un paso donde se pierde gente.

- Genera 6 dígitos con un generador criptográfico (`crypto.randomInt`),
  descartando los débiles: `000000`, `123456`, repeticiones y secuencias.
- Guárdalo **cifrado** por organización y deja que el dueño lo vea desde Ajustes
  (con permiso de configurar): es el PIN de su número.
- Errores de Meta al registrar:
  - **133005** → el número ya tenía otro PIN. Pídeselo a la persona.
  - **133008 / 133009** → demasiados intentos; Meta pide esperar.
- El `code` de OAuth es de **un solo uso** y ya se canjeó: para reintentar con
  el PIN correcto, conserva el token **en memoria del proceso** (no en la base)
  unos 10 minutos, atado a organización, usuario y app, con un máximo de 5
  intentos. Si se pierde, la persona vuelve a pulsar "Conectar" con el PIN ya
  escrito.

## 4. Conexión manual o números de agencia: override POR NÚMERO

Cuando el cliente pega sus datos a mano, o cuando una **agencia** (Tech
Provider) tiene números de varias organizaciones en la MISMA WABA, el override
a nivel WABA mandaría todos esos números a la puerta de la última organización
que guardó (y ahí el guardián de procedencia los tiraría). Usa el del número:

```http
POST /{phone_number_id}
{ "webhook_configuration": { "override_callback_uri": "<url de la org>", "verify_token": "<segmento>" } }

GET /{phone_number_id}?fields=webhook_configuration   → confirma que phone_number == tu URL
```

- Prioridad en Meta: **número > WABA > app**. El del número sobrevive a
  cualquier re-suscripción de la WABA.
- Meta exige que la app esté suscrita a la WABA antes del override. **Pero**
  `POST /{waba}/subscribed_apps` **sin cuerpo borra el override de WABA de esa
  app** (el de la agencia para sus otros números). Antes de suscribir:
  `GET /app?fields=id` (qué app es el token) y `GET /{waba}/subscribed_apps`
  (¿ya está?). Si ya lo está —siempre, tras su propio Embedded Signup— no
  vuelvas a suscribir. Ante la duda, suscribe.
- Si Meta rechaza el registro (p. ej. falta `whatsapp_business_management`),
  guarda la conexión igual y muestra el motivo, con un botón "Registrar en Meta"
  para reintentar sin volver a pegar el token.
- **Al desconectar**, quita el override del número **solo si es el tuyo**
  (compara por la ruta `/api/webhooks/wa/{org}/…`, no por la URL entera):
  `POST /{phone_number_id}` con `override_callback_uri: ""`. Si no, el número
  seguiría entregando a tu plataforma aunque el dueño configure otro webhook.
- Desconectar es best-effort: no puede fallar porque Meta no conteste.

## 5. App Review en multitenant

El espacio de revisión es un tenant más (`review.tudominio` o similar) con datos
de demostración, sin clientes reales, que abre en incógnito y deja iniciar
sesión. Los entornos de prueba jamás alcanzan la API real de WhatsApp. El resto
del proceso está en **whatsapp-meta-app-review**.
