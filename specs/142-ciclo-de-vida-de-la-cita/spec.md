# 142 · El ciclo de vida de la cita

**Carril: completo** — acciones nuevas del agente, avisos nuevos y trabajo
programado. Toca el modelo de datos.

## El problema

Hoy el agente sabe **ofrecer horarios y agendar**. Nada más. Una vez que la
cita existe, el sistema la olvida: nadie se entera de que se creó, nadie la
recuerda el día que toca, y si el cliente quiere moverla el agente no puede.

El 10-nov-2026 eso se vio entero en una conversación real de ZA Climatización.
Lucía Jazmín Franco pidió mantenimiento, el agente relevó bien el caso —3
equipos en San Lorenzo—, ofreció horarios reales y **agendó correctamente** el
miércoles 11 a las 10:00.

Seis minutos después ella escribió: «justo mañana no voy a poder, ¿podemos
reprogramar para el jueves?». El agente contestó:

> «Claro, sin problema. **Le aviso ahora mismo a nuestro equipo** para que te
> pasen al jueves.»

Y escaló la conversación, que es lo correcto cuando no podés hacer algo. Pero
el resultado fue:

- La cita **siguió en miércoles** en la agenda
- **Nadie se enteró** — ni de la cita original ni del pedido de cambio
- La clienta quedó convencida de que estaba resuelto

Tres fallos encadenados que, juntos, producen lo peor: una promesa hecha a un
cliente que no llega a ninguna persona.

## Lo que el dueño definió (10-nov-2026)

Textual, y es el contrato de esta spec:

> «Cuando alguien agenda, sí o sí tiene que avisar al equipo. Él agenda y avisa
> al equipo. Ponele, hoy agenda para mañana: hoy le avisa al equipo que hay una
> cita para mañana. Además de eso, mañana tiene que volver a recordar que hoy
> hay una cita. Eso tiene que hacerlo **al equipo y al cliente**, el día de la
> cita. Y después, si el cliente pide cancelar o reagendar, él tiene que
> cancelar o reprogramar. Y luego de que hace eso, tiene que avisar al equipo.»

### Los cuatro momentos

| # | Cuando | A quien | Que |
|---|---|---|---|
| **1** | Al agendar, en el acto | **Equipo** | Hay una cita el {dia} a las {hora} con {contacto} |
| **2** | El dia de la cita | **Equipo** | Hoy tenes una cita a las {hora} con {contacto} |
| **3** | El dia de la cita | **Cliente** | Recordatorio de su cita de hoy |
| **4** | Al cancelar o reprogramar | **Equipo** | Que cambio, de cuando a cuando |

Y una capacidad nueva: **el agente cancela y reprograma**, en vez de escalar.

## Lo que ya existe y no hay que construir

| Pieza | Donde |
|---|---|
| Ofrecer y agendar | `offer_slots` / `book_slot` en `src/server/ai/actions.ts` |
| Disponibilidad real por organizacion | `getBusyIntervals()` en `src/server/agenda/availability.ts` |
| Telefono a contacto a conversacion a plantilla a enviado | la cadena de `src/server/ai/aviso-de-atencion.ts` |
| El destinatario de los avisos del equipo | `organization.alertPhone` / `alertName` |
| La regla de que un aviso fallido nunca tumba la conversacion | el `try/catch` de `avisarAtencionHumana()` |

El aviso de cita es **la misma composicion** que el aviso de atencion humana,
con otra plantilla y otro disparador. No es codigo nuevo: es el mismo patron.

## Las dos restricciones que mandan sobre el diseno

### 1 - Fuera de la ventana de 24 horas solo entran plantillas

Un recordatorio que sale la manana de la cita casi nunca cae dentro de la
ventana de 24 h de WhatsApp: la conversacion pudo haber sido dias antes. **Eso
obliga a plantilla aprobada en Meta**, tanto para el equipo como para el
cliente.

Y ahi aparece el bloqueo que este mismo caso desta po:

| Instancia | Plantillas aprobadas |
|---|---|
| Creativo 4D Group | `aviso_atencion_humana` + dos de reenganche |
| **ZA Climatizacion** | **ninguna** |
| **Castell Muebles** | **ninguna** |

Por eso el aviso de Lucia no salio: el handoff ocurrio, llamo al aviso, y el
aviso se encontro sin plantilla y se fue en silencio --por diseno, con un
`console.warn`--. **Sin plantillas aprobadas por organizacion, esta spec entera
no puede funcionar.** Es el primer paso, y no es codigo: es tramite en Meta.

### 2 - Los recordatorios necesitan algo que corra solo

Los momentos 2 y 3 no los dispara una conversacion: los dispara **el reloj**.
Hoy el producto no tiene nada que se despierte por su cuenta -- "sin colas
externas: el trabajo en segundo plano es in-process" (CLAUDE.md). Un
recordatorio matinal es la primera pieza que de verdad necesita correr sin que
nadie escriba.

Opciones, de menor a mayor costo:

- **Barrido al arrancar y cada N minutos, in-process.** Barato, cabe en el
  monolito, y sobrevive a reinicios si la marca de "ya recordado" va en la
  base. Riesgo: con varias replicas, dos mandan el mismo recordatorio -- se
  resuelve con un `UNIQUE` por cita y tipo de aviso.
- Tarea programada externa que pegue a un endpoint firmado. Mas robusto, pero
  mete una dependencia operativa.

La primera respeta la soberania (constitucion II) y no agrega terceros.
**Recomendada**, con la marca de enviado en la base como idempotencia.

## Decisiones de producto pendientes

1. **A que hora sale el recordatorio del dia?** Primera hora fija --07:00 en la
   zona del negocio-- o N horas antes de la cita? Lo segundo es mas util para
   una cita de las 16:00.
2. **El recordatorio al cliente admite respuesta?** Si contesta "no puedo", eso
   deberia reabrir la conversacion con el agente, y entonces el recordatorio es
   tambien una oportunidad de reprogramar en vez de un planton.
3. **Reprogramar exige confirmar el horario nuevo?** El agente tendria que
   ofrecer huecos reales igual que al agendar, no aceptar "el jueves" a secas.
   El caso de Lucia lo muestra: dijo "el jueves", y jueves tiene 10:00 y 16:00.
4. **Cancelar libera el hueco en el acto?** Si, salvo que se quiera conservar
   el registro -- `status` ya distingue, y la agenda tiene "Mostrar canceladas".

## Lo que NO entra

- Que el agente mueva citas **que no creo el**. El equipo las toca desde la
  agenda.
- Recordatorios con mas de un dia de anticipacion. Primero el del dia.
- Confirmacion del cliente tipo "responde SI para confirmar". Es otra cosa.

## Estado (10-nov-2026)

| # | Pieza | Estado |
|---|---|---|
| 1 | Las plantillas en Meta | **Hecho.** 5 por cuenta en ZA Climatizacion, Castell y Creativo 4D. Las de ZA ya aprobadas |
| 2 | La rama de Zernio para plantillas | **Hecho.** `zernio-templates.ts`: crear, listar y enviar |
| 3 | `reschedule_slot` y `cancel_slot` | **Hecho.** Accion, turno, prompt y servicio |
| 4 | Avisos al equipo al agendar, mover y cancelar | **Hecho.** `aviso-de-cita.ts` |
| 5 | Recordatorios una hora antes | **Hecho.** `recordatorios.ts` + `recordatorio-de-cita.ts` |
| 6 | **Probarlo en vivo** | **Pendiente: necesita despliegue** |

### Lo que hubo que descubrir por el camino

- **`rescheduleForConversation` ya existia** en `service.ts`, con el comentario
  «es el camino del agente». El servicio estaba; faltaba la accion que lo
  llamara. Eso abarato la pieza 3 a la mitad.
- **Cancelar estaba excluido a proposito.** `api/bot/bookings/route.ts` decia:
  «Cancelar NO existe por esta superficie a proposito: esa decision es del
  dueno del negocio, no del agente. El camino es el handoff». El dueno lo
  cambio el 10-nov-2026 con el caso de Lucia delante. Lo que se conservo de
  aquella intencion vive ahora en el prompt: **antes de cancelar, el agente
  ofrece mover**.
- **Meta rechaza una plantilla que termine en variable.** Las tres que cerraban
  con `{{N}}.` hubo que reescribirlas con una frase detras.
- **Las marcas de recordatorio se borran al reprogramar.** Sin eso, mover una
  cita al dia siguiente la dejaba sin recordatorio para siempre.

## Lo que falta para cerrarla

1. Desplegar.
2. **Sincronizar plantillas** en ZA Climatizacion y Castell: las 10 viven en
   Meta pero todavia no en la tabla `template` de cada organizacion, y el
   codigo busca ahi. La rama nueva de `syncTemplates` las trae.
3. Correr el caso de Lucia de punta a punta.

## El caso que hay que poder contar al terminar

El mismo de Lucia, y que salga bien:

> Pide mantenimiento, el agente releva y agenda el miercoles 10:00. **Nathalia
> recibe un WhatsApp: "cita manana 10:00 con Lucia Jazmin Franco".** Seis
> minutos despues Lucia pide el jueves; el agente le ofrece los huecos reales
> del jueves, ella elige las 10:00, **el agente mueve la cita** y **Nathalia
> recibe el cambio**. El jueves a la manana, las dos reciben el recordatorio.
