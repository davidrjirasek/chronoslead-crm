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

Creativo 4D Group es el **primero** de varios: siguen The Student Store, Castel
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
una pieza que falta**: a The Student Store y a Castel Muebles les van a aparecer los
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
| Un directivo consultó por el servicio (caso The Student Store) | quién es, de qué institución, qué pidió |

Los dos son **mandar una plantilla a un número interno con datos de la
conversación**. No son dos desarrollos: es uno —el canal de avisos al equipo—
y cada aviso nuevo después es configuración.

La plantilla `aviso_atencion_humana` ya está **aprobada por Meta** (22-oct).

**Regla de ejecución, no negociable:** si el agente le dice al cliente «ya
estoy avisando al equipo», el aviso tiene que haber salido ANTES de prometerlo.
Es la misma disciplina que la agenda, que nunca confirma una cita antes de que
el calendario la registre. Prometer un aviso que falló es peor que no
prometerlo: el cliente se queda esperando y nadie se entera.

El caso de The Student Store le agrega valor comercial: un director que consulta
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

El test usa la frase textual del log de producción, la que se perdió.

#### PROBADO EN VIVO (2026-10-23) — y lo que destapó

El rescate **actuó dos veces** en una sola conversación real, en los registros
del contenedor:

```
[agente] el modelo contestó sin JSON; se rescata la frase
(raw=Perfecto, ya veo el panorama. Lo que pasa es que sin un sistema de
seguimiento estructurado, esas oportunidades se pierden en el día a día…)

[agente] el modelo contestó sin JSON; se rescata la frase
(raw=Perfecto. Para saber si estamos dentro del rango que están evaluando,
nuestras implementaciones parten de un setup de G. 12.500.000 y un fee desde
G. 4.000.000 mensuales. ¿Ese nivel de inversión está dentro de lo que
contemplan para resolver esta parte del negocio?)
```

Las dos se habrían perdido. La segunda es **la pregunta de calificación con
los precios**: el turno donde se decide si hay negocio.

**Pero dos veces en una conversación no es un hipo, es una tendencia.** Y la
causa ya estaba documentada en el código, en 029: *«las respuestas anteriores
del agente llegan como texto plano, y con ellas a la vista el modelo contestaba
en texto plano»*. El `TURN_FORMAT_REMINDER` se agregó para eso y **no alcanza**.

El precio de que no alcance: cada rescate quema los **3 intentos** de
`MAX_ATTEMPTS`, y cada intento manda el contexto entero —prompt, KB completo e
historial—. **Un turno rescatado cuesta ~3× uno normal**, en tokens y en
demora. El cliente no lo ve; la factura sí.

**Hipótesis para atacar la causa, sin probar:** el historial mapea los turnos
del agente a su `text` pelado, así que el modelo ve su propia voz en prosa y la
imita. Devolvérselos con la forma que se le pide —`{"action":"reply","text":…}`—
reforzaría el patrón en vez de contradecirlo. Es una hipótesis: hay que medirla
antes de creerle.

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
rechazo por firma tiene que gritar. **Arreglado esa misma noche en 119**
(`945ba35`), con `tests/unit/firma-rechazada.test.ts`.

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

### El corte de dominio, hecho (2026-10-23, 01:50)

`chronoslead.com` pasó del sistema anterior a la plataforma. Con el OK
explícito del dueño, sin clientes en el sistema viejo y antes de lanzar los
anuncios: el mejor momento posible.

**La decisión que lo volvió de bajo riesgo: NO se tocó `APP_BASE_URL`.**

Se fue a leer para qué se usa de verdad, en vez de asumir que había que
cambiarlo. En producción hace dos cosas: arma la URL del webhook
(`webhook-url.ts:28`) y le pone protocolo y puerto a los enlaces de acceso —
y en producción no hay puerto. **El enlace de acceso no sale de ahí**: sale de
`slug + baseDomain` (`access-link.ts:201`).

Dejándolo en `admin.chronoslead.com`, los webhooks de Meta y Zernio siguieron
apuntando a un dominio que no se movió. **No hubo que volver a registrar nada**
— que era justo la parte capaz de dejar la operación sin mensajes entrantes.

| Paso | Detalle |
|---|---|
| 1 | Detener la app vieja. **Desmarcar «Run Docker Cleanup»**: venía activado y habría borrado su imagen, convirtiendo el rollback en una reconstrucción |
| 2 | Quitarle sus dos dominios. **Desmarcar «borrar el registro DNS»**: venía activado, y si Coolify tocaba el DNS el dominio dejaba de resolver |
| 3 | Agregar `https://chronoslead.com` a la plataforma. Coolify agregó el `www` solo, que `resolveTenantFromHost` ya trata como landing |
| 4 | Desplegar |

**Medido:** el apex estuvo ~4 minutos en 503 mientras construía, y `admin.`
tuvo ~20 segundos de intermitencia en el cambio de contenedor (502 y 200
alternados, el mismo patrón de siempre). Los webhooks nunca se cortaron.

**Verificado en vivo:** las cuatro direcciones en 200, las tres páginas legales
en 200 —las mira Meta para el App Review—, certificado Let's Encrypt del apex
válido hasta el 29-dic, los 14 botones de la landing apuntando a
`595987550109`, `/app/login` en 404, y mensajes reales entrando por **WhatsApp
e Instagram**.

**El sistema anterior quedó detenido, no borrado**, con su imagen y su base
(`chronos-lead-db`) intactas. Encenderlo y devolverle el dominio es cuestión de
minutos si hiciera falta.

### Media landing invisible, y nadie podía saberlo (2026-10-23, 02:10)

Apenas el apex pasó a la plataforma, el dueño abrió el sitio y vio texto
ilegible: blanco sobre blanco.

**Causa:** la landing usa `bg-ink` y `text-ink`, y este proyecto **no define
`ink`** — solo `brand.ink`, que es otra cosa. Tailwind descarta la clase en
silencio. `text-ink` parecía funcionar porque heredaba un color oscuro, pero
las tres secciones de `bg-ink` —una tarjeta, el cierre y **todo el pie**—
quedaban con fondo blanco y texto blanco encima.

Arreglado en `tailwind.config.ts` con `ink: "#0B0B0B"`. El valor sale del
propio archivo: `rgba(11,11,11,…)` aparece 12 veces en sus sombras. Literal y
no token del tema porque el sitio público es de un solo tema: no tiene una
sola clase `dark:`.

**La lección, que es de proceso y no de CSS:** estaba roto desde que se portó
la landing, y **no había forma de verlo**. La landing solo se renderiza en el
apex, y el apex lo servía el sistema anterior; las dos direcciones que tenía
la plataforma —`admin.` y el subdominio del cliente— muestran el panel y el
CRM, nunca la landing. **Nadie la había abierto jamás en esta plataforma.**
El corte de dominio no la rompió: la hizo visible.

Una página que nadie puede abrir se da por buena sin pruebas. El guion E2E
debería cubrir el apex, no solo los subdominios.

### Imágenes: dos agujeros distintos, uno barato y uno caro (2026-10-23)

El dueño preguntó por imágenes y resultaron ser **dos cosas separadas**. Vale
la pena no confundirlas: una es un defecto, la otra es una función.

#### A · El pie de foto que se tira (RECIBIR) — defecto, barato

Cuando un cliente manda una foto **con texto al pie** —«acá va mi comprobante
de 200.000»— ese texto **se captura y se guarda** (`mediaAsset.caption`, en
`src/server/inbox/ingest.ts`), y el **cerebro externo lo recibe**
(`src/server/brains/deliver.ts`).

**El agente incluido nunca lo ve.** Dos motivos, los dos comprobados:

1. `message.text` queda en `null`: la ingesta lee `msg.text?.body`, y una
   imagen de WhatsApp trae su texto en `msg.image.caption`, no ahí.
2. El historial del turno es un `select()` sobre `schema.message` **sin join a
   `mediaAsset`**, así que el pie de foto no viaja.

Resultado: el agente lee «[El cliente envió una imagen. No podés verla ni
escucharla.]» y **pierde lo que el cliente efectivamente escribió**. El dato
está en la base, sin usar.

Es el mismo tipo de fallo que el audio de 112: una pieza sana cuyo contenido no
llega al modelo. Arreglo: llevar el caption al historial y usarlo en
`contenidoParaElModelo`. Aditivo, sin migración.

> **No confundir con «ver» la imagen.** Esto no la mira: solo recupera el texto
> que el cliente escribió al lado. Para que el modelo vea la foto hace falta un
> conector de visión, con el patrón de `transcripcion.ts` — y con dos
> decisiones del dueño: cuesta más por mensaje, y esas fotos (un comprobante
> lleva número de cuenta) salen hacia el proveedor del modelo.

#### B · El banco de imágenes (ENVIAR) — función, cara

Lo que pidió el dueño: que el agente tenga **un puñado de imágenes de producto
y mande la que corresponde** a lo que le preguntan. Un vendedor con el catálogo
en la mano.

**No existe.** Las acciones del agente son siete y ninguna manda archivos:
`none`, `reply`, `update_lead`, `move_stage`, `handoff`, `offer_slots`,
`book_slot`.

Lo reutilizable ya está, y es más de lo que parece:

| Pieza | Dónde |
|---|---|
| Enviar imagen con pie, por WhatsApp | `sendMediaMessage()` en `src/server/inbox/send.ts` |
| Guardar el archivo | volumen + `mediaAsset` |
| **Enseñarle al modelo una lista para que elija una** | la agenda: `mapaDeHuecosParaModelo()` inyecta los huecos y el modelo elige por id |

Ese último es el hallazgo arquitectónico: **el mecanismo ya está probado en
producción**, solo cambia el contenido de la lista.

Lo que falta: dónde vive el banco (y la **descripción de cuándo mandar cada
una**, que es lo que el modelo lee para elegir), una pantalla para cargarlas,
inyectar el catálogo en el turno, la acción nueva validada contra el banco de
**esa** organización, y los guardarraíles (el Laboratorio no manda de verdad;
la ventana de 24 h; no repetir la misma foto).

**Dos a cuatro días**, y toca el modelo de datos — o sea **ciclo completo** por
el Principio VI: spec, plan y tasks antes de código. Para comparar: el audio
fueron ~300 líneas sin tocar la base.

**Versión barata que funciona hoy, sin código:** el agente ya puede poner un
enlace en su `reply`. Con las imágenes en una URL pública y una línea en la
base de conocimiento, manda el enlace. Convierte menos que una foto en la
conversación, pero sirve para medir si la gente realmente las pide antes de
gastar cuatro días.

**Para quién es:** no para Creativo 4D vendiendo CRM. Para **Castel Muebles**
(catálogo) y **The Student Store** (la foto del menú semanal). Es función de
plataforma para el cliente siguiente, no para el lanzamiento de esta semana.

#### C · El camino del medio: mandar por URL — el que no se había visto

La pregunta del dueño («si es una URL pública, ¿dónde alojamos las imágenes?»)
destapó una tercera opción que no estaba en el análisis.

Hoy `sendMediaMessage()` manda **subiendo el archivo** y pasando
`{ id: waMediaId }`. **La Cloud API de Meta también acepta
`{ link: "https://…" }`**: Meta busca la imagen y la entrega como **foto real**,
no como enlace.

Si eso funciona, el abanico deja de ser binario:

| Camino | Trabajo | Qué le llega al cliente |
|---|---|---|
| Enlace dentro del `reply` | **cero**, funciona hoy | un enlace |
| **Mandar por `link`** | chico: la acción nueva + el catálogo, **sin tabla ni pantalla de carga** | **la foto** |
| Banco completo en el CRM | 2-4 días, ciclo completo | la foto, y el cliente la sube desde la plataforma |

> **PENDIENTE DE VERIFICACIÓN HUMANA, y es bloqueante:** que Meta acepte `link`
> sale de su documentación, **no se probó contra este código**. Media hora:
> mandar uno de verdad y verlo llegar. Sin eso, el camino del medio no existe
> y no hay que planificar encima.

**Dónde alojar las imágenes**, de menos a más trabajo:

1. **La web del propio cliente.** Cero servicios nuevos, cero costo, las
   imágenes son suyas. Castel Muebles tiene sitio. Es la de arranque.
2. **Una ruta pública en el CRM, solo para la biblioteca.** Hoy no existe:
   `/api/media/[assetId]` va con `withAuth` y `scoped()` —correcto, ahí viven
   los adjuntos privados de las conversaciones—. Haría falta una ruta aparte,
   pública a propósito. Es parte del banco completo igual.
3. **S3 / R2 / Cloudinary: prohibido en el núcleo** por la Constitución II. Si
   un cliente ya usa uno y da la URL, es asunto suyo; el producto no se
   construye encima.

**Descartado: `chronoslead.com`.** El repositorio es **público**: las fotos de
un cliente quedarían a la vista de cualquiera. Y son de un cliente, no de la
plataforma.

**Google Drive no sirve**, que fue la intuición del dueño y es correcta: un
enlace compartido de Drive entrega **una página HTML**, no el binario. Meta
busca la imagen y encuentra HTML. Los trucos de enlace directo se rompen solos
y Google los limita.

#### Costo en tokens de cada opción (2026-10-23)

El dueño preguntó si esto le sale caro al cliente. El hallazgo de fondo:
**`renderKb()` inyecta la base de conocimiento ENTERA en cada turno** — sin
búsqueda, sin recorte (`src/server/ai/prompts.ts`).

| | ¿Cuesta? | Cuánto |
|---|---|---|
| Mandar la imagen | **no** | la foto no pasa por el modelo; este solo emite un id o una URL |
| El catálogo en el contexto | sí, por turno | 5 imágenes con descripción ≈ 50-100 tokens |
| La versión del enlace | sí, por turno | **casi lo mismo**: son líneas del conocimiento, que va entero |
| El pie de foto (A) | **no** | reemplaza el texto de relleno que ya se manda |
| Visión (leer la imagen) | **sí, y mucho** | cientos a más de mil tokens **por foto recibida** |

**La conclusión que decide:** entre el banco y la versión del enlace **el costo
de operar es casi el mismo**. La elección no es cara-vs-barata de operar, es
cara-vs-barata de **construir**. El único que cuesta de verdad operar es la
visión — de ahí que vaya apagado por defecto y por organización.

### El gate de aislamiento, corrido por fin: 39/45 y ningún agujero (2026-10-24)

Corrido dos veces con el mismo resultado, o sea reproducible: **39 de 45**,
seis fallos.

```
❌ la cookie de A en SU host funciona
❌ bandeja responde a ambas — A=500 B=500
❌ el mismo evento por la puerta de A SÍ entra en A
❌ B sigue entrando: solo se cortó quien debía
❌ el mensaje a una organización suspendida SE GUARDA
❌ al reactivar vuelve a entrar
```

**Los seis son UN solo problema, y es local.** En el registro de la app:

```
routine: 'errorMissingColumn'  →  GET /api/conversations 500
```

A la base de desarrollo **le faltan las migraciones nuevas**: no tiene
`organization.alert_phone`, la que agregó 117. La bandeja consulta una columna
que no existe → 500 → y a partir de ahí el guion no puede comprobar que los
mensajes llegaron ni que la suspensión cortó, así que esas cinco caen en
cascada detrás de la primera.

**Producción no lo tiene**: allá las migraciones se aplican al arrancar el
contenedor. Es la copia local la que quedó atrás.

**Lo que SÍ quedó probado — que era la pregunta de fondo:**

| Comprobación | |
|---|---|
| Un evento por la puerta de B con el número de A **no entra en A** | ✅ |
| …y tampoco aparece en B | ✅ |
| La firma de B no abre la puerta de A | ✅ |
| Una organización inventada no tiene puerta | ✅ |
| El login de A no muestra la marca de B | ✅ |
| El enlace de acceso de A no vale en el subdominio de B, ni dos veces | ✅ |
| La credencial de cerebro de A con el id de B no vale | ✅ |
| Un subdominio inexistente no filtra la marca de nadie | ✅ |

**Ninguno de los seis fallos dice que un cliente vea datos de otro.** El
aislamiento aguanta; lo que está roto es el entorno de desarrollo.

#### 45/45 — VERDE (2026-10-25)

Con el OK del dueño se respaldó la base (`pg_dump`, 123 KB) y se corrió
`corepack pnpm db:migrate`: **le faltaban 3 de 28 migraciones**. Tras
aplicarlas aparecieron `alert_phone` y `alert_name`, y las 8 organizaciones
quedaron intactas.

Una sola corrida del guion —la lección del 429— y:

```
✅ Aislamiento verde.     45/45 comprobaciones correctas.
```

Las 13 secciones corrieron, nada omitido (se verificó que «3-5» es una sección
combinada, no tres salteadas, y que no faltó ninguna credencial). Las cinco de
Suspensión y las cuatro de ESCRITURA por webhook —las que mandan— en verde.

**Queda confirmado lo que el 24-oct era solo hipótesis:** los seis fallos eran
el entorno local atrasado, no un defecto del producto. **La plataforma está
certificada para dar de alta al segundo cliente.**

### Lo que costó llegar hasta acá (2026-10-24)

Dos errores propios, anotados porque el segundo ya es patrón:

**1 · Se dio por ausente un Postgres que estaba corriendo.** Se buscó en el
puerto 5432, en el PATH, en `/Applications` y en Homebrew — las convenciones—
en vez de leer el `.env` del proyecto, que dice `127.0.0.1:5433`. Resultado:
114 MB descargados y 390 MB instalados al pedo, después borrados. El dueño
había dicho «para mí que ya había bajado Postgres» y tenía razón.

Es el tercer caso del mismo patrón —antes el logo y la guía de despliegue—:
**asumir la convención en vez de leer lo que el proyecto declara.** La
diferencia es que esta vez no lo detectó el dueño: lo detectó el propio
Postgres al chocar de puertos. La trampa quedó escrita en `CLAUDE.md`, no en
una nota suelta.

**2 · Se corrió el guion tres veces seguidas y chocó con el 429.** El producto
limita a 10 inicios de sesión cada 10 minutos por IP. Las corridas 2 y 3 no
midieron nada; hubo que esperar 11 minutos para tener una limpia. También
quedó en `CLAUDE.md`.

### El gate que manda no se puede correr en la Mac del dueño (2026-10-24, corregido)

> **Desmentido el mismo día.** Sí se puede: la base estaba instalada y
> corriendo todo el tiempo, en el puerto 5433. Lo de abajo se conserva porque
> explica cómo se llegó a la conclusión equivocada, pero **su premisa es
> falsa**.

`CLAUDE.md` es terminante: *«**El de aislamiento manda**: mientras no esté
verde, nada está Hecho»*. Son 34 comprobaciones de que un cliente **no ve ni
escribe** en los datos de otro — el corazón de ser plataforma.

**No hay rastro de que se haya corrido desde que la plataforma está viva.** Lo
único anotado es que no debe correrse contra producción, que es correcto:
siembra sus propias organizaciones.

Y no se puede correr aquí: **esta Mac no tiene Postgres ni Docker**
(comprobado: nada escuchando en 5432, sin `docker`, sin `colima`, sin
Postgres.app, sin fórmula de brew). El `.env` local sí tiene todo lo demás
—`EDITION`, `BASE_DOMAIN`, `WA_MOCK_ENABLED`, `BOT_API_KEY`—; falta la base.

**Desde la última corrida conocida entraron, entre otras, las specs 112, 114,
115, 116, 117, 118, 119 y 120 — y dos tocaron el esquema**: `alert_phone` /
`alert_name` (117, migración `0025`) y las 19 líneas de 119. El esquema y la
multitenencia son exactamente lo que ese gate protege.

**Proporción, para no asustar de más:** hoy hay **un** cliente real en
producción. Una fuga entre organizaciones no tiene a quién fugarse. El riesgo
es bajo ahora y **se vuelve serio con el segundo cliente** — o sea, antes de
dar de alta a The Student Store.

**Qué hace falta:** que el dueño instale **una** cosa en la Mac, una vez
—Docker Desktop o Postgres.app, las dos gratis— y a partir de ahí el gate se
corre solo, cuando haga falta. No se puede hacer por él: pide su contraseña.

### La base de producción no tenía copias de seguridad (2026-10-25)

Escribiendo el manual de operaciones se revisó Coolify → la base → Backups:

```
Schedules: 0     Enabled: 0     Total executions: 0
No scheduled backups
```

**Nunca se había hecho una copia, desde que la plataforma existe.** Con un
cliente en producción y varios por entrar.

Resuelto el mismo día, con el OK del dueño:

| | |
|---|---|
| Frecuencia | diaria, `0 3 * * *` |
| Retención | 14 copias · 30 días · tope de 2 GB |
| Primera copia | a mano, 129.21 KB, correcta |

La retención estaba en 0 —sin límite— y se fijó: sin tope, las copias terminan
llenando el disco del servidor.

**Sigue faltando la mitad: las copias son `Local`**, en el mismo servidor que
la base. Protegen del error humano, no de que el servidor desaparezca. Las dos
salidas, que se complementan: snapshots del proveedor del VPS (recuperan el
servidor entero) y copias a un S3 (recuperan los datos aunque el servidor no
exista). **Pendiente: averiguar si el VPS tiene snapshots activados** — se le
consultó a Kevin.

**La lección de proceso:** la pregunta «¿hay copias de seguridad?» no la hizo
nadie en meses. Apareció sola al redactar un manual de operaciones, que es
justamente para lo que sirven los manuales. Quedó como pregunta número 1 del
`metodo-de-trabajo.pdf`.

### Dos manuales en PDF, y una sesión paralela archivada (2026-10-26)

En `~/Documents/ChronosLead/` (fuera del repo, que es público):

| Archivo | Qué es |
|---|---|
| `manual-operaciones.pdf` | 14 páginas. Inventario de servicios, credenciales, rutina de vigilancia, manual de incidentes con los casos reales, riesgos conocidos, qué hacer si el dueño no está, y trabajo en equipo |
| `metodo-de-trabajo.pdf` | 5 páginas. Método genérico para cualquier proyecto |
| `generar-manual.py` | Convierte cualquier `.md` a PDF con la marca. Usa Chrome, no instala nada |

**Se descubrió una segunda sesión de Claude sobre la misma carpeta**:
«Chronoslead Nuevo (fork)», creada el 22-oct 19:25, activa hasta el 23-oct
07:06. **Es la que hizo las specs 117 a 120**, el lío del `META_APP_SECRET` y
el corte de dominio — lo que explica los commits que aparecieron sin que esta
sesión los hubiera hecho. Archivada el 26-oct: sin worktree que limpiar y todo
su trabajo ya commiteado y documentado.

**La regla correcta**, que se precisó tras una pregunta del dueño: el riesgo no
es tener varias conversaciones sobre la misma carpeta —leer y operar en
paralelo es inocuo—, sino **dos sesiones escribiendo los mismos archivos a la
vez**. Dar de alta un cliente ocurre íntegramente en paneles web y no toca el
repositorio.

### Titularidad de las cuentas (2026-10-27)

El manual de operaciones listaba los servicios pero **no a nombre de quién
está cada cuenta ni con qué correo se entra** — el dato que hace falta
justamente el día que el dueño no está. Se agregó la sección «Cuentas y
titularidad», deliberadamente **con los huecos a la vista**: un manual que no
menciona un servicio parece completo; uno que dice «por confirmar» obliga a
completarlo.

**Hostinger** (el proveedor del VPS, que tampoco estaba nombrado) estaba a
nombre de David con su correo personal. **Migrado el mismo día a
`creativo4dgroup@gmail.com`.** Cambiar el correo de la cuenta no toca el
servidor, el DNS ni la aplicación: solo mueve a dónde llegan los avisos de
vencimiento y los restablecimientos.

**Faltan Namecheap, Cloudflare, Meta, Zernio y Groq.** El orden lo da el daño:
primero las que apagan el servicio si se pierden.

### Copias de seguridad: las tres capas, cerradas (2026-10-27)

El 25-oct se descubrió que **no había ninguna copia**. Hoy quedaron las tres:

| Capa | Cada cuánto | Qué recupera |
|---|---|---|
| Local | 6 h | los datos |
| **Cloudflare R2** | 6 h | los datos, aunque el servidor no exista |
| **Snapshot de Hostinger** | semanal | la máquina entera, en 33 min |

**R2**: bucket `chronoslead-backups`, token de cuenta acotado solo a ese
bucket, retención 120 copias / 30 días / 2 GB. **Probado**: copia manual que
llegó, verificada del lado de Cloudflare (carpeta `data/`, 6 operaciones de
escritura, acceso público deshabilitado).

**Los snapshots del VPS ya estaban activos** y nadie lo sabía — otro dato que
vivía en un panel y no en el manual. Guarda solo los dos últimos.

**No se compró la mejora a snapshots diarios** (~3,50 USD/mes): de los datos
se ocupa R2 cada 6 h y la máquina casi no cambia. Lo único que se perdería con
uno de 7 días son los cambios de configuración de esa semana — el dominio en
Coolify de un cliente nuevo, dos minutos de rehacer.

**Sigue pendiente probar una restauración.** Una copia que nadie restauró es
una suposición.

### PHP2Shell: no nos tocó, pero por poco (2026-10-27)

CVE-2026-109618 y CVE-2026-109619, puntuación 9.2, **ejecución remota sin
autenticar**, explotadas activamente (CISA KEV desde el 26-oct).

**ChronosLead no usa PHP** — verificado, ni una línea. **Pero Coolify sí**
(Laravel), y Coolify controla el servidor entero.

Coolify parcheó en **v4.4.7** (21-oct, PHP 8.4.27). La instalación corre
**v4.5.0** (23-oct), posterior, **con actualizaciones automáticas activadas**.
O sea: protegido sin que nadie hiciera nada.

**Lo que esto dejó a la vista, y es lo que importa:** el panel de Coolify es
**alcanzable desde internet** en el puerto 8000 —comprobado desde fuera de la
red del servidor—. Un panel PHP abierto, con una ejecución remota circulando,
es hoy el riesgo más grande del sistema. Estaba anotado como «sin cifrar»;
esto lo asciende a urgente.

### El 1% intermitente no existe (2026-10-27)

Una corrida anterior mostró 13 fallos repartidos en 33 minutos, que no
coincidían con ningún cambio de contenedor. Se midió **2 horas seguidas sin
desplegar nada: 7.200 consultas, CERO fallos.**

Queda descartado: no hay inestabilidad de fondo. **Todas las fallas medidas
están atadas a los despliegues.**

### Corrección de método: se medía antes de tiempo (2026-10-27)

Dos veces se informó «cero caídas» en un despliegue, y era falso. La
comprobación se hacía al aparecer el commit nuevo — pero las interrupciones
empiezan **después**:

```
fde934c: commit nuevo 14:14:55 · fallas desde 14:15:31 (36 s después) · 28 s
473f95d: commit nuevo 17:45:23 · fallas desde 17:45:57 (34 s después) · 30 s
```

**No hubo ningún despliegue limpio.** La ventana es consistente: unos 30
segundos, siempre después de que la versión nueva ya contesta, mientras el
contenedor viejo se desarma y sigue recibiendo tráfico.

### Coolify sale de internet (2026-10-28)

El panel estaba en `http://2.25.159.85:8000`: puerto expuesto, sin cifrar, con
control total del servidor. Era el riesgo número uno.

**Kevin recomendó cerrar el puerto sin pantalla de autenticación.** Correcto
para quien vive en una terminal; no para este caso: el dueño **no tiene acceso
SSH ni lo usa**, así que cerrar el 8000 nos dejaba a los dos afuera, y el MCP
—que se quería configurar— necesita justamente una URL pública con HTTPS.

**Lo que se hizo**, y resolvió las tres cosas a la vez:

1. `coolify.chronoslead.com`, HTTPS, **con escudo de Cloudflare**. El comodín
   `*.chronoslead.com` ya existía y ya era proxied: no hubo que crear DNS
2. Se verificó que el subdominio entra por el **443 vía Traefik**, no por el
   8000 — la suposición que, de estar mal, nos dejaba afuera
3. Firewall de Hostinger por API (niega todo por defecto): **solo 22, 80, 443
   e ICMP**

```
ANTES                          AHORA
6 puertos abiertos             3
sin firewall                   niega por defecto
IP del servidor visible        oculta tras Cloudflare
contraseña en claro            cifrada
```

**Comprobado desde fuera, en el minuto:** landing, CRM del cliente y panel del
operador en 200; `coolify.chronoslead.com` en 302; 8000, 6001 y 6002 cerrados;
22, 80 y 443 abiertos. **Ningún cliente se enteró.**

**IPv6**: no se pudo verificar desde la máquina del asistente (sin IPv6). Se
comprobó desde un teléfono con datos móviles: el navegador se queda colgado
sin respuesta, que es el comportamiento correcto de un DROP — no revela
siquiera que haya algo escuchando.

**Dos cosas que esto dejó a la vista:**

- **La contraseña de Coolify no la tenía nadie.** Se descubrió al intentar
  entrar por el subdominio. El recupero por correo está **desactivado** (SMTP y
  Resend), así que la única vía habría sido la consola de Hostinger. Quedó
  guardada en el gestor, y **configurar el correo de Coolify sigue pendiente**:
  es el único sistema sin forma de recuperarse solo
- **El servidor tiene 41 actualizaciones de sistema pendientes.** No se
  aplicaron: pueden pedir reinicio y no era el momento

### El MCP de Coolify, conectado (2026-10-28)

Claude ahora opera Coolify **sin navegador**: ver estado, leer registros,
desplegar. Era el último lugar donde el dueño tenía que apretar botones.

- Endpoint: `https://coolify.chronoslead.com/mcp` — la misma URL pública con
  HTTPS que se creó al cerrar el 8000. Sin ese paso, esto no era posible
- Token **Read + Write + Deploy**, deliberadamente SIN *Root* y SIN
  *Read sensitive data*. Verificado campo por campo: los valores de las
  variables de entorno **no vienen en la respuesta** (el campo `value` está
  ausente, no vacío) y las llaves SSH privadas tampoco (`private_key`
  ausente; solo pública y huella)
- **El token caduca a los 30 días** (creado el 28-oct). Cuando caduque, el
  servidor va a arrancar con `AUTH_HEADER_REJECTED` y hay que crear otro en
  Coolify → Keys & Tokens → API tokens, con las mismas tres casillas

**La trampa que costó el primer intento:** el token quedó **pegado dos veces**
en `~/.claude.json` (100 caracteres en vez de 50, la segunda mitad idéntica a
la primera) y Coolify respondía `401 Unauthenticated`. Lo que lo delató fue
probar el token contra la API REST normal (`/api/v1/version`), no contra el
MCP: al fallar las dos, quedó claro que el problema era la credencial y no el
endpoint. **Al pegar un secreto a ciegas con `read -s`, verificar el largo
antes de dar por bueno el «listo».** El guion que se usó la segunda vez
comprueba el pegado doble, la forma y la respuesta de Coolify **antes** de
escribir el archivo: si algo falla, no toca nada.

**Dos límites del token con Write, que no son del token:**

- **La API de Coolify prohíbe los ajustes del servidor.** `is_metrics_enabled`
  devuelve `"This field is not allowed."`, y lo mismo vale para las
  actualizaciones automáticas de seguridad. `manage_server` solo acepta
  nombre, IP, puerto, usuario, llave, rol, proxy y tiempos. **Las métricas y
  la seguridad del sistema operativo se encienden a mano en el panel, no hay
  otra vía**
- **El modo automático de Claude Code bloquea los borrados**, sin importar lo
  que permita el token. Correcto: un borrado irreversible pasa por el dueño.
  Para hacerlos hay que salir del modo automático

### Se barrió la chatarra de Coolify (2026-10-28)

Tres recursos apagados que contaban como «falla» en el tablero de Coolify sin
ser nada. Un tablero que marca rojo permanente es un tablero que se deja de
mirar — el mismo defecto que tenía la lista de pendientes.

| Borrado | Qué era |
|---|---|
| app `chronoslead` | Del repo viejo `davidrjirasek/chronoslead`, rama `008-crm-piso-minimo-diseno`, creada el 18-sep. **Sin dominio**: inalcanzable. Cero volúmenes |
| `evolution-api-myjhc…` | Pasarela de WhatsApp de prueba, 21-oct |
| `evolution-chronoslead` | Ídem. Hoy el CRM habla directo con la API de Meta |

Las dos `evolution` llevaban **tres volúmenes cada una**
(`evolution-instances`, `postgres-data`, `evolution-redis`). Se borraron con
sus volúmenes, con el OK explícito del dueño, porque
`delete_unused_volumes: false` en el servidor: **los huérfanos no se limpian
nunca solos.** Primero se informó «ninguna tiene volúmenes» y era falso —
cierto para la app, falso para los servicios.

**Comprobado en vivo:** los tres dominios en 200 después del borrado, y el
resumen de infraestructura con **cero recursos en falla por primera vez**.

**Lo que NO se tocó, y por qué:**

- **`n8n`** — corriendo y sano, es del dueño y está en uso
- **`chronos-lead-db`** — se sospechaba que era la base de la app vieja. No lo
  era: adentro tiene la base **`otra_dimension`**, de otro proyecto del dueño,
  creada el 17-sep. Corre sana, `is_public: false`, y **no tiene ninguna copia
  de seguridad programada.** Decisión pendiente del dueño: si va a seguir,
  merece el mismo plan de 6 horas + R2 que la de ChronosLead

### Qué dice el servidor de sí mismo (2026-10-28)

Leído con `get_server`, y corrige dos cosas que esta bitácora dejó sonando
peor y mejor de lo que son:

```
41 actualizaciones pendientes · DE SEGURIDAD: 0 · ¿pide reinicio?: NO
actualizaciones automáticas de seguridad: APAGADAS   ← el hueco real
disco: vigilado, aviso al 80%, revisión diaria 23:00
métricas (CPU/RAM/disco): APAGADAS  → no se pueden leer por API
Traefik 3.6.25 · hay 3.7.16 (actualización menor)
delete_unused_volumes: false · force_docker_cleanup: true al 80%
wildcard_domain: VACÍO
```

- **Las 41 actualizaciones no eran urgentes**: ninguna de seguridad, ninguna
  pide reinicio. Lo que sí importa es que **las automáticas están apagadas**:
  cuando salga una que cuente, nadie la va a aplicar
- **El disco no estaba a ciegas**: ya hay aviso al 80% y revisión diaria. Las
  métricas apagadas impiden *leer* el número, no vigilarlo
- **Traefik enruta todos los dominios de los clientes.** La subida a 3.7 va
  después de dar de alta a los clientes nuevos, no antes

Dos detalles del camino, para la próxima:

- Cloudflare responde **403 error 1010** a `urllib` de Python por su firma de
  navegador. Las pruebas contra el dominio hay que hacerlas con `curl` y un
  User-Agent normal
- El archivo del MCP vive en `~/.claude.json`, **fuera del repo** — no se
  versiona y no viaja a otra máquina. Y `.mcp.json`, que sí estaba versionado,
  se quitó del repo: es público

### El campo «Wildcard domain» del servidor (2026-10-28)

Visto de paso en la configuración del servidor en Coolify. **Si funciona como
parece, eliminaría el paso 2 del manual de alta** —agregar a mano el dominio
de cada cliente—, que es la trampa que más muerde en cada alta. Sin verificar.
Es la mejora operativa más grande detectada hasta ahora.

> **Al 28-oct el campo está VACÍO** (`wildcard_domain: null`, leído por el
> MCP). Y la esperanza de arriba está **sin comprobar**: hay que confirmar si
> el campo hace enrutado comodín de verdad —que Traefik acepte cualquier
> subdominio— o si solo **autogenera un dominio por defecto al crear un
> recurso nuevo**, que no resolvería nada. Son dos cosas muy distintas y la
> nota de arriba supone la buena. **No construir el alta sobre esto hasta
> probarlo.**

### El formulario de onboarding (2026-10-28, spec 127)

`onboarding.chronoslead.com` — un cliente que **todavía no existe** completa el
cuestionario de puesta en marcha por secciones, viendo cuánto le falta, y puede
cortar y volver con su enlace.

**Las tres decisiones que mandan sobre todo lo demás:**

- **El enlace es la credencial.** Sin cuenta ni contraseña: un cliente que aún
  no es cliente no debería registrarse para contarnos cómo trabaja. La llave va
  en la URL —y no en una cookie— para que pueda seguir desde otro dispositivo.
  No hay ninguna pantalla que liste formularios, así que tener una llave no
  revela que existan otras
- **Nunca crea cuentas.** El Principio VIII prohíbe el registro público y el
  autoservicio. Esto recoge respuestas; el alta la hace una persona. Si alguna
  vez el formulario termina creando la organización, eso es una **enmienda a la
  constitución**, no una mejora
- **La tabla no tiene `organization_id`,** y está declarado en el Constitution
  Check para que nadie lo lea como un olvido: el registro existe antes que la
  organización. Es capa de plataforma, como `organization` misma

**El subdominio se eligió `onboarding` y no `alta`**, por decisión del dueño:
`alta` ya es una puerta de la plataforma (`resolveTenantFromHost` devuelve
`kind:"alta"`) y no quería quemar un nombre que hace falta para otra cosa.
Quedó reservado además en `SLUGS_RESERVADOS`, como `coolify`.

Por dentro se llama **`cuestionario`**, no `onboarding`: ese nombre ya era la
guía de inicio DENTRO del CRM (`src/server/onboarding/guide.ts`). Dos cosas
distintas con el mismo nombre se confunden sí o sí.

### Lo que el gate NO atrapó (2026-10-28)

Tres fallos reales, ninguno visto por `typecheck`, `lint`, 1332 pruebas ni
`build`. **Los tres salieron abriendo el formulario en un navegador de verdad
y completándolo como lo haría el cliente.**

| Qué se veía | Qué era |
|---|---|
| Pantalla en blanco, «Application error: a client-side exception» | Un archivo `"use server"` **solo puede exportar funciones asíncronas**. Se exportaba también una constante y se importaba desde el componente. Compila callado y revienta en el navegador, **sin rastro en el registro del servidor** |
| Al primer guardado saltaba de la sección 1 a la **3** | El efecto que avanza dependía de la llave; al llegar la llave nueva corría otra vez con el mismo estado y avanzaba dos veces. El servidor guardaba bien: era solo la pantalla, y eso lo hacía más difícil de ver |
| Hidratación fallida en toda la página | El enlace para continuar se armaba con `window.location.origin` **durante el render**: el servidor dibujaba sin ese párrafo y el navegador con él |

Y dos más en el guion de lectura, que se habían dado por hechos sin ejecutarlo:
se quedaba colgado tres minutos después de imprimir —parecía que había
fallado—, y se comía el separador `--`, así que buscaba la llave `"--"`.

**La lección, concreta:** el gate del repo es necesario y no alcanza. Las cinco
fallas estaban en fronteras —servidor/navegador, guion/intérprete— que es justo
donde los tipos no miran. **Abrirlo y usarlo no es opcional.**

**Sin prueba automática:** el salto doble de sección. Es comportamiento de un
componente de React y el repo no tiene arnés para eso. Si vuelve, el primer
sospechoso son las dependencias de ese efecto.

### Precios 2026 y el encuadre comercial (2026-10-28, spec 129)

Los precios aprobados el 28-10 no estaban en ningún lado público ni en el
asesor. Se corrigieron los dos.

| | Decía | Dice |
|---|---|---|
| Landing | Desde ₲ 4.000.000 · setup ₲ 12.500.000 | Desde ₲ 6.500.000 · setup ₲ 12.000.000 |
| Asesor | lo mismo, en tres lugares | los tres planes completos |

**El riesgo no era el número, era la expectativa:** quien llegaba por la
landing calculaba ₲ 4.000.000, y el plan que **sí incluye al asesor** cuesta
6.500.000. Llegaba a la reunión 2,5 millones abajo.

Entró también la condición que no estaba en ningún lado: **12 meses, setup
bonificado; 6 meses, 6 cuotas sin intereses.**

Y un cambio de encuadre mayor que los precios: lo que se vende es el
**Sistema 4D**; ChronosLead es la **tecnología adentro**, no el producto. El
asesor decía lo contrario. La landing dejó de hablar de «un CRM», que es
justo lo que la regla comercial prohíbe vender.

### Tres cosas que esto enseñó sobre el asesor (2026-10-28)

**1 · Las instrucciones le pesan más que el conocimiento.** Las instrucciones
decían «no inventes una solución más barata: hoy no existe una oferta
definida para ese caso». Con el Plan Impulso ya cargado en el conocimiento, el
asesor **seguía descartando prospectos**. El conocimiento es la fuente de
verdad para los HECHOS; una orden de comportamiento la gana siempre. Al
agregar un plan nuevo hay que revisar las dos superficies, no una.

**2 · Se imita a sí mismo.** Probado en vivo: en la misma conversación donde
antes había dicho «el agente IA» y había supuesto que el prospecto era un
colegio, siguió diciendo las dos cosas **después** de corregir instrucciones y
conocimiento. Lee su propia voz en el historial y la continúa. Es el mismo
mecanismo que la respuesta en prosa (115). **Toda prueba de un cambio de
configuración se hace en una conversación NUEVA, o no prueba nada.**

**3 · Supone el rubro.** Sin que nadie se lo dijera, habló de matrículas y de
campañas de admisiones. A una concesionaria le habría preguntado por
matrículas. Se agregó una regla explícita de no suponer el rubro y preguntarlo.

**Una corrección de criterio, del dueño:** la primera versión de la regla de
lenguaje decía «nunca digas bot ni agente». Él la rechazó: si un cliente
pregunta «¿sos un bot?», negarlo es mentir, y mentir ahí destruye la confianza
justo cuando se está construyendo. Quedó como **preferencia** —se presenta
como «asesor IA»— **con honestidad obligatoria** si le preguntan directamente.
Probado en vivo: contesta «Sí, soy inteligencia artificial».

> **El Laboratorio no sirve para probar contenido.** Corre personas fijas con
> guiones genéricos —una pregunta el precio de un martillo— y las evalúa un
> juez. Prueba comportamiento. Para verificar precios o encuadre, hay que
> escribirle por WhatsApp.

### Decisiones de producto del 2026-10-29

Salieron de leer los briefs de Colegio Cerritos y ZA Group. **Varias las
corrigió el dueño y la suya era mejor.**

**Una oportunidad por contacto se queda como está.** El esquema tiene
`uniqueIndex("lead_contact_uq").on(contactId)`, y los dos briefs piden lo
contrario: una familia con varios hijos, un cliente que compra propiedad y
después climatización. La primera propuesta fue cambiar el modelo de datos.
**El dueño propuso algo mejor:** una familia que inscribe tres hijos no son
tres conversiones, es **una familia que convirtió con tres unidades**. Separar
las dos medidas es más correcto, no solo más barato:

```
conversión   8 familias de 30 entrevistas   ← la oportunidad
volumen      10 hijos inscriptos            ← un campo de la ficha
```

Contar 10 conversiones daría 33% de cierre en vez de 27%: un número que miente.

**No se cambia cómo se cuentan las ventas.** Resultados usa
`selectDistinctOn(leadId)`: toma el último desenlace de cada oportunidad en el
período, así que una recompra cuenta una vez. Cambiarlo movería el significado
de un número que el dueño ya mira, para todos los clientes. Con el modelo de
arriba no hace falta.

> Y aunque se quisiera: «cuántas» se puede (un cruce más en la consulta),
> «cuánto» no. El monto sale del lead ACTUAL y no hay histórico por evento;
> contar dos ventas duplicaría esa cifra.

**Varios pipelines: evaluado y pospuesto.** No existe el concepto; las etapas
cuelgan de la organización. Pasar a `organización → pipelines → etapas` toca
el esquema, el tablero, Resultados y el agente: uno o dos días con riesgo
sobre el embudo que los clientes ya usan. Forma pedida por el dueño para
cuando se haga: **nace con uno, y se pueden crear más con nombre propio.**

**Se esquiva con instancias separadas por unidad de negocio**, que además dan
embudo, agente y número propios:

| | |
|---|---|
| Colegio Cerritos | Una instancia. Extracurriculares y Campus como dato de la ficha |
| **EDI Cerritos** | **Aparte.** Tiene su propio número, sus tarifas y inscripciones todo el año |
| ZA Group | **Una sola**: su brief exige un número único para las tres unidades, y un número pertenece a una instancia |

El colegio deriva a EDI por conocimiento, igual que Fourdy deriva al número de
clientes. No hay que construir nada.

**Los briefs de los clientes reemplazan al cuestionario.** Los dos traen
tarifas, cronogramas, reglas de conversación y respuestas modelo: son el
cuestionario ya contestado, y mejor. Mandárselo sería pedirles lo que ya
dieron.

### La atribución, encendida (2026-10-29)

`ATRIBUCION=on` en Coolify y desplegado. Antes estaba apagada **sin que nadie
lo supiera**, y el dueño iba a lanzar anuncios al día siguiente.

Dos cosas distintas que conviene no confundir:

| | Estado |
|---|---|
| **Ver de qué anuncio llegó cada persona** (la tarjeta en la bandeja) | Siempre funcionó. No depende de la bandera (018) |
| **Reportarle a Meta quién convirtió** | Era lo que estaba apagado |

Sin lo segundo, Meta optimiza hacia lo único que ve —que alguien abra el
chat— y entrega el público más barato de hacer escribir, que rara vez compra.

**Falta un dato y no se pudo obtener:** el ID del dataset. El Administrador de
eventos de la cuenta muestra solo un origen de tipo app; el dataset de
mensajería es el de la cuenta de WhatsApp y se obtiene con
`POST {waba_id}/dataset`, que necesita el token de WhatsApp — cifrado en
producción. **WABA de producción: 3979964855646808.** Hasta que se pegue el id
en Ajustes → Anuncios, el interruptor está encendido pero no reporta nada.

### El primer cliente real: The Student Store (2026-10-29)

`the-student-store.chronoslead.com`. Alta hecha por el dueño desde el panel,
con el subdominio agregado en Coolify por el MCP — **el paso 2 sin que nadie
abriera Coolify**, por primera vez.

**Verificado entrando de verdad:** el operador entró con su cuenta de soporte
y vio el CRM **vacío** de ese cliente, no el suyo. Es el aislamiento
funcionando fuera del guion de pruebas, con una persona real.

**Hasta dónde llegó el alta, para no leerlo de más:** están los pasos 0 a 4
—cuestionario enviado, organización creada, dominio en Coolify, enlace
entregado y primera entrada—. **La instancia existe; el cliente todavía no
atiende a nadie.** Faltan la llave de IA, el agente, su conocimiento, la
agenda, el conector de reunión, los canales, el Laboratorio y encenderlo:
ocho de los doce pasos.

### Dos fallos que solo aparecen con un cliente real (2026-10-29, specs 133 y 134)

Ninguno dio error. El alta dijo que todo salió bien, las 1341 pruebas también,
y se descubrieron cuando una persona intentó entrar.

**1 · La cuenta de soporte nacía sin forma de entrar.** El alta la creaba con
`password: null` y solo le generaba enlace al dueño: una cuenta sin contraseña
y sin manera de ponerle una. El operador lo vio porque la pantalla lo devolvía
al login **sin decir nada** — correcto por seguridad (decir «existe pero no sos
miembro» confirmaría que el cliente existe), pero indistinguible de una
contraseña mal escrita.

**2 · «Generar enlace» era una ruleta.** Tomaba `.limit(1)` sobre los miembros
sin filtrar por rol: devolvía al dueño o al soporte según cuál saliera primero
de la base. Y como crear un enlace **invalida el anterior de esa persona**, se
podía dejar afuera al cliente creyendo que uno se lo generaba a sí mismo.
Ahora son dos botones y cada uno dice a quién.

**3 · La pantalla no decía de quién era la cuenta** (134). Decía «elige una
contraseña» y el nombre de la organización, nada más. Lo preguntó el dueño:
«fijo contraseña, ¿pero para qué usuario?». Importa más para el cliente que
para el operador: una empresa con varias personas no sabe cuál de sus correos
quedó como dueño.

> **El patrón, por tercer día seguido:** lo que el gate no ve está en las
> fronteras —servidor/navegador, alta/acceso, sistema/persona—. Las tres veces
> apareció usándolo, no compilando.

### Las pruebas no se corren junto al `build` (2026-10-29)

Dos veces en el día el gate dio rojo sin que nada estuviera roto: 5 pruebas
fallando por tiempo, con el `build` compitiendo por la máquina. Corridas solas,
1341 de 1341. El `build` tardó 2,4 minutos en vez de 80 segundos — la máquina
estaba saturada.

**Un gate que miente en rojo es tan dañino como uno que miente en verde:** la
próxima vez uno le cree menos. Corré `test` y `build` por separado, y el
aislamiento con el servidor levantado y nada más encima.

### La atribución, completa (2026-10-29, spec 135)

La cadena estaba rota en tres puntos y cada uno escondía al siguiente:

1. **El interruptor estaba apagado** y nadie lo sabía, con anuncios por lanzar
2. **El ID del conjunto de datos no se podía conseguir.** Buscado en la cuenta
   real del dueño: el Administrador de eventos muestra píxeles web, y el
   conector de anuncios devolvió dos píxeles viejos de otros proyectos. El
   conjunto de WhatsApp **no existía todavía**
3. El campo quedaba vacío, así que el interruptor encendido no reportaba nada

**La solución fue sacarle el trabajo a la persona.** `POST {waba_id}/dataset`
es idempotente y el CRM ya tiene las dos piezas —`waba_id` y token— desde que
el negocio conectó WhatsApp. Un botón, y el campo se llena solo.

**No es Embedded Signup**: ninguna ventana de Meta, ninguna cuenta ajena, y
**no hace falta el estatus de Tech Provider**. Lo preguntó el dueño y vale
dejarlo escrito, porque las dos cosas se parecen de lejos.

**El riesgo que la spec 016 dejaba abierto no se dio:** esa spec asume permiso
para PUBLICAR en el dataset, y crearlo podía pedir otro. Probado en vivo con la
cuenta real: **el token sí alcanza.** Vale para todos los clientes.

**Un fallo encontrado leyendo la salida de una prueba que pasaba.** La prueba
comprobaba que el token no viajara en la RESPUESTA, y pasaba. Al lado, en la
consola, el mensaje de error de Meta lo imprimía entero en el registro —
prohibido por el Principio I. Ahora se tapa dejando los últimos cuatro.

> **«En verde» no es «está bien».** Mirar solo el contador de pruebas habría
> dejado pasar un secreto a los registros.

### Pendiente

> **Limpiado el 2026-10-24.** Tres entradas seguían listadas estando hechas:
> conectar un número real de WhatsApp (los tres canales llevan días probados),
> el corte de dominio (hecho y verificado el 23-oct, 01:50) y el rechazo por
> firma sin rastro (arreglado en 119). Una lista de pendientes que miente se
> vuelve ruido, y es el mismo defecto que tenía el `CLAUDE.md`: el que la lee
> le cree.
>
> **Nada de lo que queda abajo bloquea el lanzamiento de anuncios.** Lo
> operativo —agente, tres canales, transcripción, rescate, aviso de atención
> humana, banderita en la bandeja, las dos cerraduras del webhook, las tres
> plantillas, el dominio— está desplegado y probado en vivo.

- ~~Correr el guion de aislamiento~~ — **HECHO, 45/45 verde** (25-oct). La
  plataforma queda certificada para el segundo cliente. **Volver a correrlo
  antes de cada alta de cliente nuevo**, que es cuando importa
- **Pasar al correo de la agencia las cuentas que siguen en uno personal.**
  Hostinger ya está; faltan Namecheap, Cloudflare, Meta, Zernio y Groq
- **Configurar el correo en Coolify** (SMTP o Resend): hoy no hay recupero de
  contraseña posible. Es el único sistema que no puede recuperarse solo
- **Probar el «Wildcard domain» del servidor**: si funciona, elimina el paso 2
  del alta
- **41 actualizaciones de sistema** en el servidor, pueden pedir reinicio
- **Probar una restauración** sobre una base de prueba: las copias existen y
  nunca se restauró ninguna
- **El modelo contesta en prosa demasiado seguido**: dos rescates en una sola
  conversación, y cada uno cuesta 3× un turno normal. El rescate tapa el
  síntoma; la causa (el agente ve su propia voz en prosa en el historial) sigue
  ahí. Medirlo antes de tocarlo
- **Ruido en los registros**: `Server Reference ID did not match … Received
  "x"` repetido. Huele a alguien tanteando acciones de servidor desde fuera.
  Mirar qué es
- **El pie de foto no llega al agente** (A, arriba): el dato ya está guardado y
  se descarta. Barato, aditivo, sin migración
- **Probar que Meta acepta `link` en un envío de media** (C, arriba): media
  hora, y **bloquea** el camino del medio. Es lo primero de este tema
- ~~Banco de imágenes~~ — **NO va por ahora.** Decisión del dueño (24-oct):
  «era una posibilidad nomás, no algo que quiero incluir todavía; puede ser
  para un cliente específico, no para Creativo ni para todas las versiones de
  ChronosLead». Queda como función a pedido de un cliente, no de plataforma.
  El análisis (A/B/C y los costos) se conserva arriba para cuando se pida.
- **El conocimiento va entero en cada turno** (`renderKb()`): hoy da igual,
  pero cuando un cliente cargue menú, precios por colegio y cincuenta P/R, cada
  mensaje va a arrastrar todo eso. Es un límite que va a aparecer
- **Conector de visión** para que el modelo lea la imagen: patrón de
  `transcripcion.ts`; decisión pendiente por costo y por datos sensibles
- **Reintentar al arrancar los entrantes sin respuesta**: hoy un mensaje que
  cae en la ventana de 6 s del despliegue se queda sin contestar para siempre
- ~~**Coolify expuesto por HTTP sin cifrar** en el puerto 8000~~ — **HECHO**
  (28-oct): está en `coolify.chronoslead.com`, HTTPS tras Cloudflare, y el
  8000 cerrado en el firewall. Verificado desde fuera
- `commitVerified:false` en el health: cosmético, Coolify no pasa
  `SOURCE_COMMIT` como build arg
- ~~Revisión en móvil (375 px)~~ — **HECHO**: la revisó el dueño y está bien
  (24-oct). Estaba marcada «pendiente de verificación humana» porque Claude no
  podía probarla; la verificación humana es él, y la dio.
