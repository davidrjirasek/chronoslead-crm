# 149 · Los adjuntos que llegan por Zernio

**Carril: completo** — toca el modelo de datos y la ingesta de tres canales.

## El problema

Un cliente de Castell le mandó una foto al agente para pedir un presupuesto. El
agente contestó que no podía verla. El dueño lo vio y pidió que pueda.

Mirando por qué, apareció algo más grande: **en los clientes conectados por
Zernio, los archivos no se guardan en absoluto.** Está escrito como limitación
conocida en `zernio-ingest.ts`:

> «El adjunto no se descarga todavía (Zernio lo entrega como URL temporal): el
> mensaje entra con su tipo para que la bandeja enseñe QUÉ llegó en vez de
> perderlo en silencio.»

El normalizador toma del evento **el texto y el tipo**, y descarta la URL. El
mensaje se guarda con `type: "image"` y sin `media_asset`.

Comprobado en vivo el 19-nov-2026 en The Student Store: tres mensajes
salientes de tipo `image`, los tres con `media: null`.

### Lo que eso rompe, y no era obvio

| Síntoma | Lo que ve el cliente |
|---|---|
| «Imagen enviada» que al hacer clic no abre nada | el asesor no puede revisar lo que mandó |
| El agente dice que no puede ver la foto | una consulta de presupuesto que no avanza |
| Un PDF entra como «documento» y nada más | el comprobante no queda guardado |
| **Las notas de voz NO se transcriben** | `transcribirNotaDeVoz` sale en `if (!msg.mediaAssetId) return` |

Lo último es el que más engaña: el health dice `transcripcion: true` —la
bandera y la llave están— y es verdad. Lo que falta es el archivo. Hoy los
audios solo se transcriben en los clientes por Cloud API.

### Y bloquea lo que viene

El dueño quiere que el agente **vea** las fotos. Sin esto, la visión no
serviría en los clientes por Zernio: no habría ninguna imagen que mandarle al
modelo. Primero se recibe, después se mira.

## Lo que ya existe y no hay que construir

| Pieza | Dónde |
|---|---|
| Guardar el binario en disco | `saveMediaFile()` en `src/server/whatsapp/media.ts` |
| La fila del adjunto | `media_asset`, con `fetchStatus` y `fetchError` |
| Límites de tamaño por tipo | `MEDIA_LIMITS` |
| Servir el archivo a la bandeja | la ruta de media, que ya lee `storagePath` |
| Transcribir, una vez que hay archivo | `transcribirNotaDeVoz()` |

Lo único que falta es **traer el archivo**, y que `ensureAssetAvailable()` sepa
bajarlo de una URL además de bajarlo de Graph.

## Decisiones

### 1. La URL se guarda, y se baja en el acto

Zernio entrega una URL **temporal**. Se baja al ingerir, sin esperar a que
alguien abra la bandeja: si se deja para después, caduca.

Se guarda igual en `media_asset.source_url`, por dos motivos: permite
reintentar en la ventana en que sigue viva, y cuando falla deja ver **qué** se
intentó bajar en vez de un `failed` mudo.

### 2. `ensureAssetAvailable` gana un segundo camino, no un gemelo

Hoy exige `waMediaId` y credenciales de Graph —que por Zernio son `null` por
diseño (139)—. Gana una rama: sin `waMediaId` pero con `source_url`, baja de
esa URL directo, sin cabecera de autorización. Mismos límites, mismo guardado,
mismos estados.

Un segundo módulo paralelo sería la forma de que dentro de seis meses los dos
caminos tengan límites distintos sin que nadie se entere.

### 3. Nada bloquea la ingesta

Vale la regla de siempre: el fallo de una descarga deja el mensaje en pie con
`fetchStatus: "failed"`. Una foto que no bajó no puede costar el mensaje.

### 4. Lo viejo no se recupera

Las URLs de los mensajes que ya entraron caducaron. Esto vale **de acá en
adelante**; las tres imágenes de The Student Store no vuelven.

## Requisitos

- **FR-01** · `media_asset.source_url`, nullable. Migración aditiva.
- **FR-02** · Los normalizadores de Zernio llevan del adjunto su **URL**, su
  tipo, y el nombre de archivo y mime cuando vengan.
- **FR-03** · Vale para los dos sentidos: lo que entra y el eco de lo que el
  negocio mandó desde el teléfono.
- **FR-04** · Vale para **WhatsApp y Messenger**, que son los que ingieren
  adjuntos y les tiran la URL.

  **Instagram queda fuera, y no por recorte:** su normalizador no mira los
  adjuntos en absoluto —entra todo con `type: "text"` fijo—, así que ahí una
  foto no llega ni como «imagen». Es un agujero distinto y más hondo que este,
  y merece su propia medición en vez de un parche colgado de esta.
- **FR-05** · `ensureAssetAvailable()` baja de `source_url` cuando no hay
  `waMediaId`, con los mismos límites de tamaño.
- **FR-06** · La descarga corre al ingerir, sin bloquear la respuesta al
  webhook.
- **FR-07** · Una descarga fallida deja `fetchStatus: "failed"` y el mensaje
  intacto.
- **FR-08** · Con el archivo guardado, `transcribirNotaDeVoz()` funciona sin
  tocarla.
- **FR-09** · Los clientes por Cloud API no cambian en nada.

## Criterios de aceptación

| # | Se verifica | Cómo |
|---|---|---|
| **AC-1** | Un entrante con adjunto por Zernio queda con su archivo en disco y `fetchStatus: available` | E2E con el simulador |
| **AC-2** | El eco de un saliente también | E2E |
| **AC-3** | Una URL caída deja `failed` y el mensaje entero | E2E |
| **AC-4** | Un adjunto más grande que el límite no se guarda | unitario |
| **AC-5** | Una nota de voz por Zernio termina transcrita | unitario sobre el enganche |
| **AC-6** | Cloud API sigue bajando por Graph, igual que antes | unitario + aislamiento |

## Fuera de alcance

- **Visión** (que el modelo mire la imagen). Esto le da de qué mirar; mirarla
  es la spec siguiente, con su decisión de costo y de datos.
- **Leer el texto de un PDF.** Con esto el PDF queda guardado; extraerle el
  texto es otro trabajo.
- **Recuperar los adjuntos viejos.** Sus URLs caducaron.
