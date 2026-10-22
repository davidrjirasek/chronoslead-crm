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

Creativo 4D Group es el **primero** de varios: siguen Student Store, Castel
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

### Hallazgo: las personas del Laboratorio son de una ferretería (2026-10-21)

Las seis personas de `src/server/lab/personas.ts` traen **guiones fijos**
escritos para la demo de Vocero, la Ferretería El Martillo: preguntan por
martillos, desarmadores, lijadoras, pintura y tiner.

En una instancia de un solo negocio eso es un detalle. **En una plataforma es
una pieza que falta**: a Student Store y a Castel Muebles les van a aparecer los
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
| Un directivo consultó por el servicio (caso Student Store) | quién es, de qué institución, qué pidió |

Los dos son **mandar una plantilla a un número interno con datos de la
conversación**. No son dos desarrollos: es uno —el canal de avisos al equipo—
y cada aviso nuevo después es configuración.

La plantilla `aviso_atencion_humana` ya está **aprobada por Meta** (22-oct).

**Regla de ejecución, no negociable:** si el agente le dice al cliente «ya
estoy avisando al equipo», el aviso tiene que haber salido ANTES de prometerlo.
Es la misma disciplina que la agenda, que nunca confirma una cita antes de que
el calendario la registre. Prometer un aviso que falló es peor que no
prometerlo: el cliente se queda esperando y nadie se entera.

El caso de Student Store le agrega valor comercial: un director que consulta
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
