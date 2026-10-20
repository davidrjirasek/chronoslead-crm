<!--
SYNC IMPACT REPORT
==================
Versión: (nueva) → 1.0.0

Origen: arnés SaaS multitenant 1.0.0 (29-sep-2026), destilado de la constitución
4.0.0 de Vocero Cloud. REEMPLAZA íntegramente la constitución 1.4.0 de Vocero CRM
que traía este repo, cuyo marco era «una instancia = un negocio».

Los principios I, III, IV, V, IX y X no se negocian: son los que evitan que un
cliente vea los datos de otro. Relajar uno exige motivo escrito aquí y subir la
versión MAYOR.

Decisiones del operador incorporadas al ratificar (2026-10-20):
  - Altas: solo el operador, a mano. Sin registro público ni autoservicio.
    → se eliminó la dependencia opcional «fuente de elegibilidad».
  - Cobro: fuera del sistema. El estado de pago es una fecha de «pagado hasta»
    en la base propia, movida por el operador; el adaptador de cobro queda
    descrito para que un proveedor pueda entrar después sin tocar el resto.
  - Gracia: 7 días desde la primera detección de impago, como ajuste de
    configuración. Suspender nunca borra datos.
  - Reventa / agencias: fuera. Cada organización es un negocio final.
    → se eliminaron las secciones [OPCIONAL: AGENCIAS] y [OPCIONAL: REVENTA].
  - Almacenamiento de objetos (S3) y correo transaccional: fuera por ahora;
    volumen local para adjuntos y entrega manual de accesos.
  - IA: llave de OpenRouter por organización, emitida y pagada por la plataforma.
    → deroga a propósito el Principio II de Vocero («jamás credenciales de una
      plataforma central»); motivo en Governance.

Plantillas dependientes:
  - CLAUDE.md y AGENTS.md — ✅ actualizados en este mismo cambio: las secciones
    del arnés quedaron por encima de las de Vocero, sin pisarlas.
  - .specify/templates/ — ✅ compatibles (sin cambios).

TODOs diferidos:
  - El inventario de atajos single-tenant de Vocero (paso 0 de la skill
    `saas-multitenant`) aún no existe: es lo primero de la fase siguiente.
-->

# ChronosLead Constitution

ChronosLead es un SaaS multitenant de atención y venta por WhatsApp con un agente de IA que conoce el negocio. UNA
instancia, operada por Creativo 4D Group en su propia infraestructura, sirve a MUCHAS
organizaciones, cada una en su subdominio (`{slug}.chronoslead.com`), con sus
propios canales, credenciales y cerebro (agente de IA). Esta constitución define
las reglas no negociables del producto. Aplica a todas las fases del flujo de
trabajo (specify, plan, tasks, implement). Cualquier conflicto entre una decisión
de implementación y esta constitución SE RESUELVE A FAVOR de esta constitución.

## Core Principles

### I. Seguridad de Datos Primero (NO NEGOCIABLE)

La protección de datos es la primera responsabilidad del sistema, por encima de
velocidad de entrega o conveniencia de desarrollo.

- Tokens, credenciales y secretos NUNCA se exponen al cliente (navegador, app,
  respuestas de API) ni se escriben en logs, trazas o mensajes de error.
- Todo secreto se almacena cifrado en reposo. Las claves de cifrado viven fuera
  del código fuente y fuera del control de versiones. Hacia fuera solo se
  muestran los últimos 4 caracteres.
- Todo dato de un tenant está aislado de los demás: ninguna consulta, endpoint o
  tarea en segundo plano devuelve o modifica datos de un tenant distinto al del
  solicitante. El aislamiento se aplica por defecto, no por recordarlo.

**Rationale**: Una fuga de credenciales o un cruce de datos entre clientes es un
fallo catastrófico e irreversible; prevenirlo siempre cuesta menos que remediarlo.

### II. Soberanía del Operador y Dependencias Cerradas

ChronosLead opera completo sobre la infraestructura del operador: su
servidor, su base de datos, su proxy. La lista de dependencias externas en
runtime es CERRADA:

1. **WhatsApp Cloud API** (Meta Graph API): el canal es la razón de ser del
   producto. La versión de Graph vive en UNA sola variable (`META_GRAPH_API_VERSION`,
   p. ej. v26.0), nunca repetida en el código.
2. **El proveedor LLM**, opcional POR ORGANIZACIÓN, accedido EXCLUSIVAMENTE a
   través de un adaptador compatible con OpenAI/OpenRouter. [QUIEN_PAGA_LA_IA:
   «Cada organización pega SU token; sin token, funciona como CRM sin agente» |
   «El operador paga la IA con un token de plataforma y la mide por
   organización»].
3. **Conectores opcionales** (otros canales, agenda, etc.), solo bajo TODAS
   estas condiciones:
   1. **Apagados por defecto**: se encienden por bandera de despliegue o por
      organización al conectar sus propias credenciales.
   2. **Aislados tras un adaptador** con contrato estable; el dominio no conoce
      al proveedor.
   3. **La instancia funciona completa sin ellos** y su fallo degrada de forma
      definida: nunca bloquea ni pierde la operación core.
   4. **Autorización propia por organización, cifrada** (Principio I). Compartir
      identidad de aplicación (un client ID de plataforma) no autoriza compartir
      la cuenta ni el token de nadie.
   5. **Verificables apagados y encendidos**: la CI ejercita ambas posiciones y
      cada conector tiene mock con camino infeliz.
4. **Proveedor de cobro, solo tras un adaptador y ausente hoy**: el estado de pago
   vive SIEMPRE en la base propia, como una fecha de «pagado hasta» por
   organización. El dominio pregunta únicamente «activa o vencida», nunca el
   vocabulario de un proveedor. Hoy esa fecha la fija el operador a mano desde la
   plataforma: no hay proveedor de cobro conectado y no hace falta ninguno. El día
   que entre uno, solo cambia QUIÉN mueve la fecha; la suspensión, la gracia y el
   resto del sistema no se enteran. Checkout alojado si llega: ningún dato de
   tarjeta toca la instancia nunca.

- **PROHIBIDO como dependencia del núcleo**: cualquier tercero fuera de esta
  lista. Autenticación y base de datos corren self-hosted (Better Auth + PostgreSQL
  propios de la instancia).

**Rationale**: Lo que un cliente conecta es suyo, cifrado y desconectable sin
romper a los demás; y un proveedor caído nunca debe apagarle el producto a nadie.

### III. Multi-Tenancy Real (NO NEGOCIABLE)

El sistema sirve a organizaciones independientes desde una sola instancia. El
multi-tenancy no es un modelo latente: es el modo de operación.

- Cada organización (tenant) gestiona sus propios usuarios, roles y permisos.
- El identificador de tenant (`organization_id`) es un parámetro de primer nivel
  en el modelo de datos y en la capa de acceso a datos. Toda tabla de dominio lo
  lleva NOT NULL e indexado con la organización primero. Toda consulta de
  dominio pasa por un helper que EXIGE el tenant (`scoped()` o equivalente).
- **El tenant se resuelve por subdominio** (`{slug}.chronoslead.com` →
  `organization.slug`). Toda superficie sin sesión (login, marca, favicon)
  resuelve la organización del Host; NUNCA «la única organización de la
  instancia» ni «la primera de la tabla».
- **La autorización se evalúa contra la organización del Host**: una sesión
  válida necesita membresía en ESA organización (o mandato delegado explícito y
  vigente); sin ella, 401/403. Prohibido el patrón «primera membresía del
  usuario». Cada operación revalida revocaciones.
- Las sesiones son por host (cookies host-only): la sesión de un subdominio no
  viaja a otro.
- Un subdominio sin organización muestra «esta instancia no existe»: jamás datos
  ni marca de otra organización.
- **Sin reventa ni agencias intermedias**: cada organización es un negocio final y
  solo el operador da altas. Nadie crea organizaciones para terceros. Si algún día
  se admite, entra como nivel de permisos nuevo con sus propias pruebas de
  aislamiento, nunca estirando el modelo actual.

**Rationale**: Con muchos tenants reales, cada resolución implícita («la única
org», «la primera membresía») es un cruce de datos esperando a que exista la
segunda organización. Resolver por Host vuelve el aislamiento estructural.

### IV. Idempotencia en Integraciones Externas

Todo evento entrante de un sistema externo (webhooks, callbacks) se procesa de
forma idempotente.

- Recibir el mismo evento dos o más veces NO duplica efectos observables.
- Cada evento entrante se identifica de forma única (p. ej. `wa_message_id`
  UNIQUE) y su procesamiento se registra para descartar reintentos.

**Rationale**: Los proveedores reintentan por diseño; sin idempotencia, los
reintentos corrompen datos y repiten acciones del agente.

### V. Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)

- "Hecho" requiere, como mínimo: tipos, lint y build en verde, y tests donde
  apliquen.
- Lo que no se pueda verificar automáticamente se marca «pendiente de
  verificación humana»; no se reporta como completado.
- Nunca se reporta «debería funcionar»: o pasa la verificación, o se declara el
  estado real, incluidos los fallos.

**Rationale**: La verificación automática es la única definición de "hecho" que
no depende de optimismo.

### VI. Specs Antes de Código

Ninguna feature se implementa sin especificación previa del comportamiento
observable. El **carril** se declara ANTES de escribir código:

- **Ciclo completo** (`specify → plan → tasks → implement`): obligatorio si toca
  el **modelo de datos** (cualquier migración) o un **contrato publicado**
  (webhook, contrato del cerebro, API que consuma alguien fuera del repo).
- **Carril ligero** (`spec.md` únicamente): comportamiento observable nuevo sin
  tocar datos ni contratos. Basta con: problema, comportamiento con criterios de
  aceptación verificables, y qué se decidió NO hacer y por qué.
- **Exento**: typos, formato, refactors internos sin cambio de contrato,
  dependencias y herramientas.

Si una feature del carril ligero descubre que necesita migración o contrato,
**sube de carril** antes de continuar. Un spec escrito después de implementar se
marca visiblemente como tal.

**Rationale**: Un único ciclo pesado para todo se erosiona en silencio hasta que
«specs antes de código» significa «sin specs»; nombrar el carril ligero lo evita.

### VII. Trazabilidad de Decisiones

- Las decisiones tomadas con información incompleta se registran de forma visible
  (spec, plan, PR o `NEEDS CLARIFICATION` con responsable), no en el código.
- Los supuestos que condicionan el comportamiento se hacen explícitos para que un
  humano pueda revisarlos y revertirlos.

**Rationale**: Las decisiones implícitas bajo incertidumbre son la principal
fuente de deuda oculta.

### VIII. Foco Vertical + Capa de Plataforma

Para cada organización, esto es un CRM de conversaciones y leads de WhatsApp con un
agente de IA que conoce su negocio y puede agendar citas. Lo que no ayude a atender,
organizar y convertir las conversaciones de UN negocio se rechaza.

La **capa de plataforma** es alcance nuclear, porque el producto ES el servicio
a muchas organizaciones:

- Aprovisionamiento de organizaciones **solo por el operador**: no hay registro
  público ni autoservicio. Las organizaciones las crea SOLO el script de
  aprovisionamiento o el superadmin, nunca un endpoint genérico. Reabrir el
  registro es una enmienda, no un ajuste.
- Suspensión y reactivación; revalidación periódica. Una baja o impago inicia
  7 días de gracia desde la primera detección, sin reiniciarse por
  reintentos. Indisponibilidad del proveedor NO es baja.
- **Persistencia de los datos**: suspender retira el servicio, NUNCA los datos.
  Ninguna rutina automática borra ni purga la base de una organización
  suspendida; el borrado ocurre solo por petición explícita de su dueño.
  Reactivar devuelve todo intacto.
- Cuotas por organización (almacenamiento, mensajes, gasto de IA) con
  degradación definida: al llegar al límite se deja de descargar lo nuevo, jamás
  se pierde un mensaje ni se bloquea la bandeja.
- Panel de superadmin para el operador (listar, crear, suspender, ver uso). Toda
  concesión o revocación registra autor, motivo, vigencia y afectados.
- **Estado de pago**: cada organización lleva una fecha de «pagado hasta» que el
  operador mueve al cobrar. Vencida esa fecha arrancan los 7 días de gracia; si se
  cumplen y sigue vencida, el sistema suspende solo. Los días de gracia son un
  ajuste de configuración, no código.

Sigue FUERA del alcance: marketing masivo, envío de campañas no solicitadas,
scraping de números, constructor visual de flujos, y cualquier canal que no sea la
API oficial de su plataforma.

**Rationale**: El foco por organización es lo que hace útil el producto; la capa
de plataforma es lo que lo vuelve un negocio operable sin cruzar datos.

### IX. Verificación de Comportamiento en Vivo (NO NEGOCIABLE)

Complementa el Principio V: TODA feature con comportamiento observable se
verifica ejerciéndolo como un usuario real antes de declararse "Hecha".

- **Self-test y loop por quien implementa**: camino feliz Y camino infeliz
  (degradación sin colgarse). Si falla, se diagnostica, corrige y re-verifica
  hasta verde. No se delega la prueba funcional al dueño.
- **Se conduce la interfaz real**: navegador (Playwright) para UI, línea de
  prueba del canal para mensajería, API donde esa sea la superficie.
- **El guion de AISLAMIENTO es el gate de la plataforma**: dos organizaciones
  vivas, A jamás ve ni escribe nada de B (bandeja, pipeline, reportes, media,
  webhooks, tiempo real, sesiones, IA). Mientras no esté verde, ninguna historia
  está Hecha.
- **Local primero, nube después**; subdominios locales con `*.lvh.me`.
- **Guardarraíles con herramientas no oficiales** vinculadas a un número real:
  solo destinatarios de una allowlist, nunca ráfagas, volumen mínimo.

**Rationale**: El gate técnico no detecta que un dato de A se asomó en B; eso
solo aparece ejerciendo el flujo real con dos tenants.

### X. Hub de Eventos y Cerebros Enchufables

La plataforma es el hub: **todo evento de canal entra por ella y todo envío sale
por ella**. Los cerebros (agentes de IA) son enchufes intercambiables.

- **Ingesta antes que inteligencia**: cada evento se valida (firma), deduplica y
  persiste ANTES de despacharse a un cerebro. La caída de un cerebro jamás
  pierde un mensaje.
- **Evento normalizado**: los canales se traducen a un evento común
  (organización, conversación, canal, remitente, contenido, idempotencia). Un
  agente no conoce el formato de Meta; un canal no conoce a los agentes.
- **Exactamente UN cerebro activo por organización**
  (el agente incluido de Vocero por defecto). Nunca dos cerebros sobre la misma
  conversación.
- **Contrato público y firmado**: el despacho a un cerebro externo va firmado
  (HMAC) y con reintentos; la respuesta entra por la API autenticada por
  organización. Los tokens de canal y las llaves de IA NUNCA salen de la
  plataforma.
- **Degradación a humano, visible**: si el cerebro no responde, la conversación
  se marca para atención humana y se notifica. El silencio nunca es silencioso.
- El cerebro interno usa el MISMO despachador y contrato que los externos.

**Rationale**: «Enchufar otros agentes sin tocar código» solo sobrevive si el
contrato es la única puerta; la degradación a humano convierte la caída de un
agente en un retraso, no en clientes ignorados.

## Restricciones de Plataforma y Seguridad

Verificables en revisión:

- **Secretos**: se inyectan por entorno o gestor de secretos, nunca en control de
  versiones. Las credenciales de cada organización (tokens de canal, llaves de
  IA, secretos de webhook) viven cifradas en la base, por organización.
- **Frontera de tenant**: la capa de datos exige el tenant; cualquier acceso que
  pueda omitirlo se justifica por escrito. Incluye el subdominio: resolución por
  Host, membresía contra la organización del Host, sesiones host-only, rate
  limits con clave por organización.
- **Webhook por organización**: cada organización tiene su propia URL de webhook
  con un segmento firmado (derivado, no guardado), y la ingesta comprueba que la
  organización del CUERPO del evento es la de la puerta por la que entró.
- **Subdominios reservados**: `www`, `admin`, `alta`, `api`, `app` y los de
  infraestructura nunca se asignan a una organización.
- **Instancia pública endurecida**: rutas de mock/desarrollo responden 404
  incondicional en producción; el registro libre está cerrado; los entornos de
  prueba JAMÁS alcanzan la API real de WhatsApp.

## Flujo de Desarrollo y Puertas de Calidad

- **Orden**: según el carril (Principio VI). Ciclo completo:
  `specify → plan → tasks → implement`. Ligero: `specify → implement`.
- **Constitution Check**: SIEMPRE, en los dos carriles. En el ciclo completo,
  en el plan (antes de la Fase 0 y tras el diseño); en el ligero, en el spec.
- **Definición de Hecho**: tipos + lint + build + tests, y para comportamiento
  observable el self-test en vivo del Principio IX con el guion de aislamiento.
- **Trazabilidad**: decisiones bajo incertidumbre documentadas (Principio VII).

## Governance

Esta constitución es la autoridad máxima del proyecto; ante un conflicto, gana.

- **Relación con upstream**: este proyecto ES un fork de `kevinrivm/vocero-crm`
  (MIT), partido de la v1.6.0. Se hacen merges regulares para heredar sus
  correcciones, y el remoto `upstream` está bloqueado para escritura: de ahí solo
  se trae. Un merge JAMÁS relaja esta constitución: lo que la viole (una
  resolución «la única org», un `limit(1)` sobre `organization`) se adapta en el
  merge. **Fork delgado**: lo propio entra detrás de `EDITION=cloud` en vez de
  borrar código de upstream, porque cada borrado es un conflicto futuro. Las specs
  propias numeran desde `101` para no chocar con las de upstream.
- **Conflicto heredado y resuelto**: la constitución de Vocero (Principio II)
  prohibía «credenciales de una plataforma central» para el proveedor de IA. Aquí
  se deroga a propósito: la llave de OpenRouter es por organización pero la emite y
  la paga la plataforma, cifrada en reposo y con el gasto separado por organización.
  Es la diferencia entre un producto self-hosted y un SaaS operado.
- **Enmiendas**: por escrito, con motivación, aprobadas por David Jirásek y
  registradas con su Sync Impact Report.
- **Versionado**: MAYOR = se elimina o redefine un principio; MENOR = principio
  o sección nueva; PARCHE = redacción.
- **Cumplimiento**: cada PR verifica estos principios; la complejidad que viole
  uno se justifica o se elimina.

**Version**: 1.0.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
