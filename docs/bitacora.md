# Bitácora — ChronosLead

Qué se hizo, cómo se probó y dónde vive cada cosa, en la operación real.
**Nunca valores de secretos**: como mucho, sus últimos 4. La bitácora del
upstream, en `bitacora-2.0.md`.

## 2026-10-20 — Fase 5: la plataforma en producción

### Qué quedó corriendo

VPS único, Coolify v4.4.6, proyecto `chronos-lead`, entorno `production`.

| Recurso | Qué es |
|---|---|
| `postgresql-database-rwwdxz…` | `postgres:17-alpine`. Base `postgres`, usuario `postgres`, puerto 5432, red `coolify` |
| `chronoslead-crm:main-fts5…` | La app. Repositorio **público**, rama `main`, build pack `dockerfile`, puerto 3000 |
| Volumen | `…-chronoslead-data` montado en `/data` |

**Postgres 17 y no 16** como fija el compose del upstream: así producción y el
desarrollo local corren la misma versión. Las migraciones son SQL corriente.

| Dirección | Qué sirve |
|---|---|
| `admin.chronoslead.com` | Panel del operador. También es `APP_BASE_URL` mientras dure la prueba |
| `creativo-4d-group.chronoslead.com` | El CRM del primer cliente de la plataforma |
| `chronoslead.com` + `/app/*` | **El sistema anterior, intacto.** No se tocó |

Los `www.` de esos dos subdominios los agregó Coolify solo y se borraron:
`www.admin.chronoslead.com` tiene dos etiquetas antes del dominio y la
resolución lo rechaza a propósito (aceptar `a.b.dominio` dejaría que un host
inventado cayera en un tenant real).

**`nuevo.chronoslead.com` se descartó.** La idea era un subdominio de pruebas,
pero aquí todo subdominio no reservado **es un cliente**: habría sido «el
cliente llamado nuevo» y mostraría «esta instancia no existe». Las reservadas
están en `src/lib/tenant/host.ts`, y solo tres hacen algo: `admin`, `alta` y
`www`.

### Variables

14 en la app, en runtime. Las de plataforma (`EDITION=cloud`,
`BASE_DOMAIN=chronoslead.com`, `PLATFORM_SUPERADMIN_EMAILS`,
`LANDING_ORG_SLUG=creativo-4d-group`, `DIAS_DE_GRACIA=7`) no existen en el
upstream. **Sin `OPENROUTER_API_TOKEN` a propósito**: la decisión de producto
es una llave por organización, guardada cifrada desde Ajustes → IA.

Fuera, también a propósito: `WA_MOCK_ENABLED`, `META_GRAPH_BASE_URL`,
`OPENROUTER_BASE_URL` (simuladores), y `MEDIA_DIR`/`PROVISION_DIR`, que la
imagen ya trae.

### Lo que se encontró en el camino

**Las herramientas de alta no viajaban en la imagen** (arreglado en 110). En
plataforma no hay registro público: la primera cuenta se crea con `provision`,
y ese guion solo existía como código fuente. El despliegue habría quedado sano
y sin forma de que entrara nadie — ni el cliente ni el operador, que necesita
una cuenta de usuario para llegar al panel. El upstream no lo sufre porque ahí
el primer registro crea la organización; esa puerta es justo la que
`EDITION=cloud` cierra.

**La guía de despliegue ya existía** (`INSTALL-IA.md`, escrita para que la siga
una IA) y se estaba redactando otra en paralelo. Lo detectó el dueño
preguntando. La regla quedó en `CLAUDE.md`.

### Cómo se probó

- `GET /api/health` → `{"ok":true,"version":"1.6.0","commit":"b2798aa",…,"mediaWritable":true}`.
  **`mediaWritable:true`** es la comprobación del upstream de que el volumen
  quedó montado: en `false`, los adjuntos y logos se pierden en cada despliegue
- `admin.chronoslead.com` sirve la entrada; con sesión de superadmin, el padrón
- `creativo-4d-group.chronoslead.com` daba «esta instancia no existe» **antes**
  del alta y la pantalla de entrada **después**: el alta es lo único que cambia
- Un subdominio inventado → 503, ni llega a la app
- `chronoslead.com` y `chronoslead.com/app/login` → 200 durante todo el proceso
- Los dos recorridos completos, hechos por el dueño: entrar al CRM del cliente,
  y entrar al panel con el mismo usuario
- `node provision.mjs` dentro del contenedor creó la organización y escribió el
  enlace en `/data/.provision/` — lo que cerró la verificación pendiente de 110
- Ajustes → IA: «Probar conexión» correcta (1525 ms), llave `…33a9` guardada
  cifrada

**El guion de aislamiento NO se corrió contra producción**, y no debe: siembra
sus propias organizaciones —quedarían en la base real— y da por encendidos los
simuladores. Es un gate del código y vive en local.

### Pedido del dueño: manual de alta de un cliente (2026-10-21)

Creativo 4D Group es el **primero** de varios: siguen THE Student Store, Castel
Muebles y los demás. Cada uno se configura igual, y hoy ese procedimiento solo
existe en esta conversación.

Hace falta un **manual paso a paso** para que cualquiera del equipo pueda dar de
alta una instancia —con Claude Code al lado, pero sin depender de que alguien
recuerde el orden—. Cubre el recorrido completo, desde cero:

1. Alta de la organización (`provision.mjs`) y entrega del enlace de primer
   acceso al cliente
2. Primera entrada del cliente: elegir contraseña, qué ve, los cuatro pasos de
   la guía de inicio
3. Proveedor de IA: llave propia por organización, probar conexión
4. El agente: nombre, tono, instrucciones, escalado, saludo
5. La base de conocimiento: qué va en bloques y qué en preguntas/respuestas, y
   **por qué los datos duros van ahí y no en las instrucciones**
6. La agenda: franjas, duración, respiro, aviso, ventana y **zona horaria**
7. El conector de reunión (Zoom o Google) y cómo crear sus credenciales
8. Canales: WhatsApp, y después Instagram/Facebook
9. El Laboratorio antes de encender el agente
10. Encender, y qué revisar la primera semana

Lo que se aprendió configurando Creativo 4D va en ese manual, no en la memoria
de nadie: el campo Tono es de una línea y se come los saltos; la zona horaria
nace en Ciudad de México; Zoom llama `:admin` a sus permisos; el cuarto permiso
de Zoom es el que rompe «Probar».

El material de Creativo 4D sirve de **ejemplo trabajado** del manual, pero el
contenido comercial de cada cliente vive fuera del repo: este es público.

**Escrito el 2026-10-22**: [alta-de-cliente.md](alta-de-cliente.md), con los
doce pasos y su lista de control. Le entró un paso que no estaba en el pedido
original y que es el que más muerde — el **2 · agregar el dominio en Coolify**.
El 503 de un subdominio inventado ya estaba anotado arriba como comprobación de
que un host inventado no cae en un tenant real; lo que faltaba era decir la otra
cara: **ese mismo 503 le pasa a un cliente legítimo** hasta que alguien agrega
su dominio a mano y despliega.

### Hallazgo: las personas del Laboratorio son de una ferretería (2026-10-21)

Las seis personas de `src/server/lab/personas.ts` traen **guiones fijos**
escritos para la demo de Vocero, la Ferretería El Martillo: preguntan por
martillos, desarmadores, lijadoras, pintura y tiner.

En una instancia de un solo negocio eso es un detalle. **En una plataforma es
una pieza que falta**: a THE Student Store y a Castel Muebles les van a aparecer los
mismos clientes simulados preguntando por martillos.

Lo que el Laboratorio sí mide con esos guiones es valioso y no hay que perderlo:
**si el agente inventa**. En la corrida de Creativo 4D (score 100 sobre 5 casos;
uno sin veredicto porque el juez no respondió válido) quedó probado que Fourdy
no se inventa una política de garantías ni el precio de un galón de pintura, y
que escala con la frase configurada.

Lo que NO mide es el comportamiento comercial propio de cada negocio. Para
Creativo 4D: los cinco factores de calificación, el filtro económico y —la
regla que más importa— **no ofrecer horarios antes de validar la inversión**.
Ninguna de las seis personas lo toca.

Opciones, para cuando se decida: personas por organización (configurables desde
la app, como el conocimiento), o un segundo juego de personas genéricas B2B que
no asuma catálogo de productos. La primera encaja con el resto de la
plataforma; la segunda es más barata y no resuelve el caso general.

Relacionado con el manual de alta: cada cliente nuevo se va a topar con esto.

### 2026-10-21 — La primera conversación real, y lo que enseñó

Un prospecto simulado por el dueño, por WhatsApp, de punta a punta. El agente
hizo descubrimiento antes de vender, no se apuró, y **creó una reunión de Zoom
real**. La cadena completa funciona. Lo que falló, falló en lugares que ni el
Laboratorio ni las pruebas unitarias podían ver.

#### Lo que se arregló en configuración, el mismo día

| Qué | Causa |
|---|---|
| Preguntaba «¿Meet o Zoom?» y mandaba un enlace de Zoom | El conocimiento decía «primera opción Meet o Zoom», heredado del manual del dueño. Pero hay **un solo conector configurado**: ofrecía algo que no podía cumplir |
| La lista de horarios no seguía lo que pedía el cliente | Ver abajo: es del núcleo. Se mitigó explicándole al agente cómo funciona la lista |

#### Hallazgos del núcleo

**Una nota de voz corta el turno.** El audio entra sin texto, el modelo recibe
un turno vacío y responde vacío; el sistema lo toma como fallo del proveedor y
pausa la IA. `[agente] falló del proveedor (raw): respuesta del proveedor sin
contenido`. En este mercado la gente manda audios constantemente.

**La lista de horarios no puede seguir la conversación.** `offer_slots` solo
acepta un texto de introducción: el sistema registra **todo** el catálogo pero
muestra siempre los más próximos. Si el cliente pide otro día, el agente lo
dice bien en prosa —lee el catálogo real, no inventa— y la lista visible lo
contradice. Falta un parámetro para decir qué mostrar.

**Zoom no sincroniza con Google Calendar las reuniones creadas por API.**
Probado con todo configurado: integración conectada con permiso de escritura y
sincronización bidireccional encendida. La cita no aparece. Editarla a mano en
el portal de Zoom **sí** la empuja. El comentario de `agenda-connectors.ts`
—«Zoom sincroniza con el calendario del dueño por su cuenta, si él lo configuró
allá»— resultó optimista.

#### La regla que fijó el dueño: la IA no se apaga sola

Hoy `applyHandoff` acepta cinco motivos —`manual_reply`, `cliente`, `modelo`,
`error`, `ventana`— y **los trata a todos igual**: marca el handoff y la IA se
calla. Pero en cuatro de los cinco **nadie tomó la conversación**.

> Lo único que debería callar a la IA es que una persona haya respondido de
> verdad.

Fuerza del argumento: la conversación de hoy murió por `error`, y el prospecto
mandó **tres mensajes de texto más**. Con esta regla, esos tres habrían
despertado al agente — el bug del audio habría sido un tropiezo y no una
conversación perdida.

Ya hecho en configuración: al escalar, el agente avisa qué pasa, cuándo le
responden y que sigue disponible. Después de escalar queda **disponible pero no
insistente** — «respondés cuando te hablan; no insistís cuando no». Si el
cliente pidió expresamente una persona, confirma y deja de llevar la charla.

Falta en código: que `error` y `ventana` no pausen la IA.

#### Pedidos de producto del dueño, por orden

1. **Aviso de handoff por WhatsApp**, con plantilla aprobada por Meta. Es el
   único con espera ajena: la aprobación no depende de nosotros
2. **Banderita roja** en la Bandeja. Hoy «Atención humana» se ve igual de neutra
   que «Nuevo»: lo urgente y lo rutinario parecen lo mismo
3. **Check de «la tomé yo»**, con nombre y hora — «tomada por David, 14:20» —
   para que dos personas no se pisen
4. **Transcripción de audios.** El dueño: «hoy ya es casi un commodity; si
   nuestra gente no hace eso, se queda muy atrás»
5. **La insignia del commit** no debería verla el cliente. Es información de
   operador. Forzar un `commitVerified` falso sería peor que el aviso actual

La cadena de los tres primeros: el aviso te trae, la banderita te dice dónde, el
check evita que se pisen.

### Avisos al equipo: un mecanismo, muchos disparadores (2026-10-22)

El dueño pidió dos avisos en días distintos, y son la misma pieza:

| Disparador | Aviso |
|---|---|
| Una conversación escaló a atención humana | quién espera, desde cuándo y por qué |
| Un directivo consultó por el servicio (caso THE Student Store) | quién es, de qué institución, qué pidió |

Los dos son **mandar una plantilla a un número interno con datos de la
conversación**. No son dos desarrollos: es uno —el canal de avisos al equipo—
y cada aviso nuevo después es configuración.

La plantilla `aviso_atencion_humana` ya está **aprobada por Meta** (22-oct).

**Regla de ejecución, no negociable:** si el agente le dice al cliente «ya
estoy avisando al equipo», el aviso tiene que haber salido ANTES de prometerlo.
Es la misma disciplina que la agenda, que nunca confirma una cita antes de que
el calendario la registre. Prometer un aviso que falló es peor que no
prometerlo: el cliente se queda esperando y nadie se entera.

El caso de THE Student Store le agrega valor comercial: un director que consulta
por el comedor de su colegio es un contrato entero. Sin el aviso, ese lead
depende de que la persona haga un segundo esfuerzo —escribir a otro número—.
Con el aviso, el equipo puede tomar la iniciativa.

### Bandeja unificada, verificada en vivo (2026-10-22)

WhatsApp, Instagram y Messenger entrando a la misma bandeja, con su distintivo
de canal y su contador. Probado mandando un mensaje real por cada uno.

| Canal | Cómo entra | Cuenta |
|---|---|---|
| WhatsApp | Cloud API de Meta, directo | +595 987 550109 |
| Instagram | Zernio | `@creativo4dgroup` |
| Messenger | Zernio | página `Creativo 4D` |

Para encenderlo hicieron falta dos cosas: `CHANNELS=whatsapp,instagram,messenger`
en el despliegue, y **una sola API key de Zernio** —la misma para los dos
canales, porque la llave es de la cuenta y no de la red—. El webhook lo da de
alta el CRM en Zernio al conectar, limitado a las cuentas del negocio, sin
tocar los webhooks que esa llave tenga de otras herramientas.

**Entran los mensajes directos; los comentarios de publicaciones no.** Eso
sigue siendo una pieza que falta, y en campañas de Meta buena parte de la
interacción son comentarios.

### Una respuesta buena, descartada por no venir envuelta (2026-10-21)

Fernando mandó una nota de voz y se quedó sin contestar. La conversación
escaló a humano por `error`. En los logs del contenedor:

```
[agente] fallo del proveedor (raw): sin JSON extraíble
(raw=Entiendo. ¿Con qué agencia o de qué forma están manejando ahora las
campañas, y qué sentís que les está faltando para que funcione mejor?)
```

**La transcripción funcionó y la respuesta era buena.** Lo único que faltó fue
el envoltorio: el agente le pide al modelo un objeto JSON con la acción a
tomar, el modelo escribió la frase suelta, los tres reintentos de `chatJson`
volvieron igual, y la frase se tiró.

Eso contradice la Definición de Hecho de este mismo repo: «un hipo del
proveedor nunca tumba el turno». El reintento estaba, la extracción robusta
estaba; lo que faltaba era el último escalón — **si después de todo eso hay
una frase utilizable, usarla**.

Arreglado en `src/server/ai/rescate.ts`: `chatJson` ahora devuelve el último
`raw` también cuando falla, y el pipeline manda esa frase antes de escalar.
Con tres candados, porque no todo crudo es una frase:

| Se descarta | Por qué |
|---|---|
| Empieza con `{`, `[` o ` ``` ` | Es el envoltorio a medio escribir, no una frase |
| Menciona `json`, `"action":`, `schema`, `esquema del` | Delata la maquinaria; un cliente nunca tiene que leer eso |
| Pasa de 1200 caracteres | No es un mensaje de chat, es otra cosa |

El test usa la frase textual del log de producción, la que se perdió. Que el
rescate funcione contra el modelo real queda **pendiente de verificación
humana** hasta que vuelva a pasar en vivo.

### Cuánto corta un despliegue (2026-10-22)

El dueño preguntó si actualizar corta las conversaciones. Lo que dice el
código, no la intuición:

- **Nada de lo que ya llegó se pierde.** El entrante se guarda en la base
  —otro contenedor, que no se reinicia— antes de que el agente piense nada.
- **Hay una ventana de 6 segundos.** `AGENT_COALESCE_MS` (`src/lib/env.ts:59`)
  es la espera a propósito para juntar varios mensajitos en una sola
  respuesta, y vive en un `Map` en memoria del contenedor
  (`src/server/ai/pipeline.ts:60-69`). Si el contenedor se reemplaza justo en
  esos 6 s, ese mensaje queda guardado **sin respuesta automática, y nadie lo
  reintenta**.

Seis segundos dentro de un despliegue de minutos: poco probable, no
imposible. Mientras no haya reintento al arrancar, la práctica es desplegar
sin nadie escribiendo y mirar la bandeja justo después.

**Y además hay un segundo hueco, que no estaba en el código sino en el
cambio de contenedor.** Medido en el despliegue de `2210f14` con dos sondas
independientes consultando `/api/health` cada segundo, 862 mediciones:

| | |
|---|---|
| Duración del build | 6 min (el anterior, 8 min 58 s) |
| Ventana con problemas | **18:23:27 → 18:23:55, 29 segundos** |
| Dentro de esa ventana | 42 intentos: 21 bien, **21 con error 502** |
| Racha más larga sin contestar | 2 segundos |

No es un apagón limpio: durante esos 29 segundos el servidor **alterna**,
contesta uno sí y uno no. Es el repartidor de Coolify mandando tráfico al
contenedor viejo mientras lo desarma. El commit nuevo ya contestaba a los
**4 segundos** de empezar la ventana; lo que coletea es el viejo.

Lo que esto significa para la operación: **un webhook de Meta que caiga en
esos 29 segundos tiene ~50% de chance de recibir un 502.** Meta reintenta las
entregas fallidas, así que el mensaje debería llegar igual, con retraso —
pero eso **no está verificado en vivo**, es lo que documenta Meta.

Corrige lo que se había estimado antes de medir: el riesgo no eran 6
segundos, y el motivo era distinto al que se suponía.

**Segunda y tercera medición (mismo día): CERO.** Los despliegues de
`babf841` y `fef85ea` no tuvieron ni una medición caída. Así que **el hueco no es fijo**: a veces aparece y a
veces no, y decir «la ventana son 29 segundos» era convertir una medición en
ley. La forma honesta:

| Despliegue | Mediciones caídas |
|---|---|
| `2210f14` | 21 en una ventana de 29 s (~50 % de los pedidos) |
| `babf841` | 0 |
| `fef85ea` | 0 (incluye la migración `0025`) |

Lo que se puede afirmar con tres datos: **puede haber hasta medio minuto de
intermitencia, o ninguna.** La práctica no cambia —desplegar sin nadie
escribiendo y mirar la bandeja después—, pero el número sí: es un techo
observado, no lo que pasa siempre.

### El canal de avisos, y el motivo que estábamos tirando (2026-10-22)

Hasta hoy, cuando una conversación escalaba **no se enteraba nadie**: quedaba
marcada en la bandeja y publicada por SSE, y si nadie miraba la pantalla, el
cliente esperaba. Las escaladas que más valen son justo las de fuera de hora.

**El hallazgo que abarató el diseño.** La acción de escalar del modelo ya
llevaba el motivo en palabras (`actions.ts:23`, `reason`) y el pipeline lo
descartaba. El dueño pedía avisos por categoría —«quiere agendar una cita»,
«quiere visitar una propiedad», «un proveedor precisa respuesta por pagos»— y
la respuesta no era construir una taxonomía: era **dejar de tirar lo que el
modelo ya escribía**. Una lista de categorías queda corta ante el motivo
número cinco; el modelo no.

| Qué | Dónde |
|---|---|
| El motivo en palabras | `conversation.handoff_note` |
| A quién avisar | `organization.alert_phone` / `alert_name` |
| La decisión y el envío | `src/server/ai/aviso-de-atencion.ts` |
| El enganche | `applyHandoff()` |
| La pantalla | Agente → «Aviso de atención humana» |

Migración `0025`, puramente aditiva: tres columnas nulables.

**Las dos reglas que no se pueden romper, y por qué existen:**

`applyHandoff` escribía **sin mirar el estado previo**. Un cliente que manda
cinco mensajes a una conversación ya escalada habría generado cinco avisos.
Ahora lee antes de escribir y solo avisa el PASO a escalada.

El envío **jamás lanza**. Si Meta rechaza o la plantilla desapareció, se
registra y se sigue: la conversación del cliente no paga el fallo de su propia
notificación. Misma regla que la agenda con sus conectores.

**Alcance de esta vuelta: un destinatario por organización.** Cada aviso es una
conversación que Meta cobra; con cuatro destinatarios cada escalada cuesta
cuatro. Decisión del dueño. Queda anotado para después el **destinatario de
plataforma** —que la agencia se entere de las escaladas de todos sus
clientes—, que no es «un destinatario más» sino otro concepto: transversal, no
por organización.

### El canal de avisos, probado en vivo (2026-10-22, 23:12)

Dos pruebas reales contra producción, una por cada camino de escalada.

**Camino 1 — el cliente pide un humano.** Llegó el aviso con el motivo de
respaldo: «el cliente pidió hablar con una persona». Correcto: hay un
detector de intención (`matchesHandoffIntent`) que corre ANTES del modelo y
escala al instante sin gastar una llamada. El modelo nunca opina, así que no
hay palabras suyas — y para eso existe el texto de respaldo.

**Camino 2 — el modelo decide.** Se escribió «soy cliente y tengo un problema
con la factura de este mes». No cae en el detector, así que el modelo pensó,
decidió escalar y escribió su motivo. El aviso llegó diciendo:

> Motivo: **Cliente actual con problema de facturación**

**Eso confirma el hallazgo completo**: `action.reason` se escribe, se guarda en
`handoff_note` y llega al aviso. Las categorías que pedía el dueño existen sin
que nadie configure ninguna lista.

Verificado de paso, sin pruebas aparte: la hora sale en la zona del negocio
(23:12 reales, no la del servidor), y el teléfono dentro del `{{2}}` lo
convierte WhatsApp en enlace tocable — que era el motivo de ponerlo ahí: que
el aviso se pueda **reenviar** a alguien que no entra a la plataforma.

### Las categorías las decide Meta (2026-10-22)

Las tres plantillas quedaron aprobadas, y una se reclasificó sola:

| Plantilla | Mandada como | Quedó en |
|---|---|---|
| `reenganche_prospecto_frio` | Marketing | Marketing |
| `reenganche_consulta_pendiente` | Utilidad | **Marketing** |
| `aviso_atencion_humana` | Utilidad | **Utilidad** |

La que importaba para el canal de avisos se quedó en Utilidad, que era el
riesgo real: en Marketing, Meta limita cuántos mensajes recibe una persona por
día y **cualquiera puede darse de baja** — un canal de avisos que se apaga solo
es peor que no tenerlo.

La reclasificada solo cuesta más. Y Meta tiene razón: invitar a retomar una
conversación comercial **es** marketing. No conviene buscarle la vuelta.

### Lo que quedó andando al cerrar el 22-oct

| Qué | Estado |
|---|---|
| Transcripción de notas de voz | **Probado en vivo** |
| Rescate de respuestas sin envoltorio JSON | Desplegado; falta que el proveedor vuelva a fallar para verlo actuar |
| Canal de avisos de atención humana | **Probado en vivo, por los dos caminos** |
| Las tres plantillas de Meta | Aprobadas |
| La puerta del operador se presenta como tal | Desplegado |
| Manual de alta de un cliente | Escrito |

**Dos números, y no son intercambiables.** Confirmado por el dueño:

- `595 987 550109` — **ventas**. Es el del agente, y al que apunta la landing
- `595 976 260002` — **clientes actuales**. El agente deriva ahí los temas de
  cuenta y facturación, y eso es correcto

Salió de ver al agente derivar a un cliente al 976 y preguntar antes de
"arreglarlo". El número no está en el código: vive en la base de conocimiento,
así que es configuración del negocio y no se toca desde aquí.

### META_APP_SECRET cortó todos los mensajes entrantes (2026-10-23, 00:15)

Se agregó `META_APP_SECRET` en Coolify para activar la segunda cerradura del
webhook (la firma `x-hub-signature-256`). **Dejaron de entrar los mensajes.**
Un número nuevo escribió al 987 y no apareció en la bandeja.

Se quitó la variable, se volvió a desplegar, y los mensajes entraron de
inmediato. Confirmado con un mensaje real.

**Por qué estuvimos veinte minutos a ciegas, y es un defecto del código:**
cuando la firma no cuadra, el webhook devuelve `401` **sin escribir una sola
línea en el registro**. «No hay rastro» se lee igual que «no llegó nunca». Un
rechazo por firma tiene que gritar. **Pendiente de arreglar.**

**RESUELTO la misma noche (01:15).** La hipótesis era correcta: el secreto
copiado era de la app `ChronosLead` (id `2170205020228499`), la nueva, la que
se prepara para Tech Provider. La app suscrita al número es **`Creativo 4D CRM
Wapp`** (id `2836268363425327`), la vieja —se reconoce porque sus URLs legales
apuntan a `creativo4dgroup.com`, no a chronoslead.com—. Con SU secreto, los
mensajes entraron de inmediato.

**Las dos cerraduras del webhook quedaron puestas**: el segmento secreto en la
dirección y la firma verificada. **Probado en los tres canales**: WhatsApp,
Instagram y Messenger siguen entrando con la firma activa (los dos sociales
van por Zernio, que valida contra el secreto de la organización y no contra
`META_APP_SECRET`, pero se comprobó en vivo en vez de suponerlo).

Se probó en este orden a propósito: primero el registro del rechazo, después
el secreto. Así la prueba dejó de ser a ciegas — si fallaba, el registro lo
decía.

**La lección de proceso:** se presentó como «dos minutos» un cambio que puede
cortar toda la operación. No lo era. La prueba de un mensaje real ANTES de
cerrar es lo que lo detectó; sin ella, el primer lead de los anuncios se
perdía en silencio.

**Cuarta medición del hueco de despliegue: 34 mediciones caídas**, la mayor
hasta ahora. La serie completa: 21, 0, 0, 34. Confirma que es variable y que
el número no se puede prometer.

### Pendiente

- **Reintentar al arrancar los entrantes sin respuesta**: hoy un mensaje que
  cae en la ventana de 6 s del despliegue se queda sin contestar para siempre
- Conectar un número real de WhatsApp y probar en vivo que el agente conteste y
  agende (Ajustes → WhatsApp; el webhook lo registra el CRM solo al guardar)
- **El corte de dominio**, que requiere el OK explícito del dueño. Al mover el
  apex: `APP_BASE_URL` pasa a `https://chronoslead.com` y hay que **volver a
  registrar el webhook en Meta**, porque su URL sale de esa variable. El
  sistema anterior queda **detenido, no borrado**, una semana
- **Coolify está expuesto por HTTP sin cifrar** en el puerto 8000: la
  contraseña del panel —control total del servidor— viaja en claro en cada
  entrada. Ponerlo detrás de HTTPS
- `commitVerified:false` en el health: cosmético, Coolify no pasa
  `SOURCE_COMMIT` como build arg
- Revisión en móvil (375 px) de las pantallas del CRM: **pendiente de
  verificación humana**
