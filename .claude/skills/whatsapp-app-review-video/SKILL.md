---
name: whatsapp-app-review-video
description: Convierte las grabaciones de pantalla de tu SaaS de WhatsApp en los dos screencasts que exige Meta App Review (whatsapp_business_management y whatsapp_business_messaging) — un archivo por permiso, sin audio, con rótulos en inglés en una franja bajo la interfaz, tarjetas de título, tecleo acelerado y chats de terceros difuminados. ACTÍVATE cuando pidan "edita mis videos para App Review", "arma el screencast para Meta", "qué clips grabo para la revisión", "ponle subtítulos en inglés al video de Meta" o compartan clips crudos de su SaaS para enviar a revisión, aunque no digan "skill". Trae el inventario de clips, un script de montaje probado (ffmpeg + Pillow) y el QA que evita rechazos.
---

# Screencasts para Meta App Review (WhatsApp)

Esta skill produce los **dos videos** que se suben en *Revisión de la aplicación → Uso permitido*, uno por permiso:

| Archivo | Permiso | Lo que tiene que demostrar |
|---|---|---|
| `<app>-management-create-template.mp4` | `whatsapp_business_management` | La app lee la cuenta de WhatsApp (WABA) conectada, lista plantillas y **crea una plantilla** que queda con el estado que devuelve Meta |
| `<app>-messaging-send-and-receive.mp4` | `whatsapp_business_messaging` | Un mensaje entrante llega a la bandeja por webhook, se responde desde la app y **llega al teléfono**; se envía una plantilla aprobada y **llega al teléfono** |

Formato de salida (lo aplica el script): **1920×1200** = interfaz a 1920×1080 + **franja de rótulos de 120 px debajo** · H.264 · 30 fps · **sin pista de audio** · rótulos en inglés quemados · tarjeta de título al inicio y al final.

## Por qué así

Son las reglas que deciden un rechazo (guía de envío de App Review verificada el 11-sep-2026 y cinco casos aprobados de la comunidad):

- **Meta no escucha el audio** ("Omit audio; our reviewers will not listen to it"). Narrar ya no hace falta: basta pantalla + rótulos.
- **Rótulos en inglés** en cada paso, sobre todo si la interfaz del SaaS está en español.
- **El permiso en acción, no el onboarding.** El único rechazo documentado (mar-2026) fue un video que solo mostraba conectar el número. Management = crear la plantilla. Messaging = el mensaje que llega al teléfono.
- **La franja va debajo de la interfaz.** Con subtítulos encima, el texto que se teclea queda tapado (pasó en la masterclass). La franja de 120 px lo evita.
- **60–120 s por video.** Los aprobados que conocemos duran entre 68 y 121 s.
- **Nada sensible en pantalla:** tokens, App Secret, PIN, contraseñas, datos de pago, chats o teléfonos de terceros.

## Requisitos

- `ffmpeg` y `ffprobe` en el PATH — Windows: `winget install Gyan.FFmpeg` · macOS: `brew install ffmpeg` · Linux: `sudo apt install ffmpeg`
- Python 3.9+ con Pillow — `python -m pip install pillow`
- El script vive en `scripts/montar_screencast.py` dentro de la carpeta de esta skill. Úsalo con su ruta completa.

## Flujo

### 1. Confirma que hay algo real que grabar

Antes de hablar de video, verifica con el usuario (si falta algo, resuélvelo con las skills hermanas `whatsapp-meta-app-review` y `whatsapp-saas-meta-infra`):

- [ ] Hay un número conectado al SaaS. Antes del acceso avanzado, lo normal es el **número de prueba de Meta conectado con token de usuario del sistema**.
- [ ] La app de Meta está **publicada**; si no, los webhooks de mensajes no llegan y no hay entrante que grabar.
- [ ] El teléfono del usuario está en la **lista de destinatarios permitidos** del número de prueba.
- [ ] `hello_world` aparece **aprobada** en la lista de plantillas del SaaS.
- [ ] Un mensaje del teléfono **ya llegó** a la bandeja y una respuesta **ya llegó** al teléfono. Si no, se arregla antes de grabar.
- [ ] El botón "Conectar con Meta" abre el popup de Embedded Signup desde un navegador con un perfil de Facebook **con rol en la app**, aunque ya haya un número conectado.

### 2. Planea los clips con el usuario

Lee `references/inventario-de-clips.md` y entrégale una tabla adaptada a su producto: código de clip, qué grabar y el nombre de cada botón en **su** interfaz. Se graban **tres archivos crudos**: `A` (apertura común), `M` (management) y `S` (messaging).

### 3. El usuario graba

Tú no puedes grabar su pantalla. Dale las reglas de grabación del inventario y pídele las rutas de los tres archivos crudos cuando termine.

### 4. Inspecciona los crudos

```bash
python <skill>/scripts/montar_screencast.py inspeccionar clips/A.mkv --cada 2
```

Genera hojas de contacto con marcas de tiempo (`hojas_A/hoja-01.jpg`, …). **Míralas** para elegir el `desde`/`hasta` de cada clip y detectar lo que hay que ocultar o recortar: autocompletado de correo, aviso de "guardar contraseña", tecleo del número personal, esperas largas, intentos fallidos. Para las coordenadas de un difuminado o un zoom:

```bash
python <skill>/scripts/montar_screencast.py cuadro clips/S.mkv 12.5
```

Exporta un cuadro de 1920×1080 con cuadrícula de 100 px. Las cajas se escriben como `[x, y, ancho, alto]` en esas coordenadas.

### 5. Escribe el EDL

Copia `scripts/ejemplo-edl.json` a la carpeta de trabajo del usuario, por ejemplo `app-review/edl.json`, y adáptalo. Los rótulos salen de `references/rotulos.md`, ajustados a lo que de verdad se ve. Formato:

| Campo | Dónde | Qué es |
|---|---|---|
| `marca` | raíz | Nombre del producto; sale en las tarjetas |
| `color_acento` | raíz | Hex opcional (`#0D5BFF` por defecto) |
| `bloques` | raíz | Segmentos con nombre que se reutilizan, por ejemplo la apertura común |
| `videos[].salida` | video | Ruta del MP4 final, relativa al EDL |
| `{"tarjeta", "subtitulo", "segundos"}` | segmento | Tarjeta de título. `tarjeta` = nombre exacto del permiso |
| `{"bloque": "apertura"}` | segmento | Inserta un bloque |
| `id`, `clip`, `desde`, `hasta`, `rotulo` | segmento | Clip del crudo, en segundos, con su rótulo en inglés |
| `velocidad` | segmento | Opcional. `2.5` para acelerar el tecleo; menciónalo en el rótulo ("typing sped up") |
| `difuminar` | segmento | Opcional. Lista de cajas `[x, y, ancho, alto]` |
| `zoom` | segmento | Opcional. Una caja que se amplía a pantalla completa, para números de teléfono o IDs pequeños |

Las rutas de los clips son relativas al EDL. Un rótulo que no cabe en dos líneas aborta el montaje: acórtalo.

### 6. Monta

```bash
python <skill>/scripts/montar_screencast.py montar app-review/edl.json
```

Renderiza cada segmento, concatena, exporta y añade `LEEME-entrega.txt` con duración y sha256 de cada archivo. Con `--conservar` se guardan los segmentos intermedios para depurar.

### 7. QA — no se entrega sin esto

```bash
python <skill>/scripts/montar_screencast.py revisar app-review/salida/<video>.mp4
```

Comprueba duración, resolución y ausencia de audio, y genera `<video>.hoja.jpg`. **Mira la hoja** y recorre `references/qa.md`. Corrige el EDL y vuelve a montar las veces que haga falta.

### 8. Entrega

Dile al usuario qué archivo va en qué permiso y recuérdale que el **texto de cada permiso** debe contar los mismos pasos en el **mismo orden** que su video (`whatsapp-meta-app-review` → `references/03-textos-app-review.md`).

## Reglas duras

- Sin audio. Sin excepción.
- Nunca muestres tokens, App Secret, PIN, contraseñas, códigos OTP ni datos de pago. Ante la duda, recorta el segmento o difumina.
- Difumina las listas de chats y los teléfonos de terceros. El número de prueba de Meta y el teléfono propio del usuario, que es el destinatario permitido, pueden verse.
- No anticipes estados: si la bandeja dice `sent`, el rótulo dice *sent*, no *delivered*.
- Si el número se conectó con token de usuario del sistema, un rótulo lo dice: *"Pre-approval: connected server-side with a System User token"*. Debe coincidir con el texto del permiso.
- No inventes pasos que el video no muestra ni muestres pasos que el texto no menciona.
- El bot de IA **no** hace falta en estos videos. Meta evalúa mensajería y plantillas, no la inteligencia del agente.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| `No encuentro ffmpeg` | Instálalo y reabre la terminal para que tome el PATH |
| `Falta Pillow` | `python -m pip install pillow` |
| Letra fea o sin acentos | Define `SCREENCAST_FUENTE_NEGRITA` y `SCREENCAST_FUENTE` con rutas a un `.ttf` |
| `Rotulo demasiado largo` | Máximo dos líneas (~150 caracteres): parte el clip en dos segmentos |
| `tiempos fuera de rango` | `desde`/`hasta` pasan de la duración del crudo; revisa la hoja de contacto |
| `caja invalida` | La caja se sale de 1920×1080; usa `cuadro` para medir |
| El video pasa de ~120 s | Acelera tecleos (`velocidad`) y recorta esperas; no quites pasos probatorios |
