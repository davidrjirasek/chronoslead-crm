# 146 · La agenda de recursos

**Carril: completo** — toca el modelo de datos, la disponibilidad, el agente,
los avisos y el panel de superadmin.

## El problema

Colegio Cerritos tiene **dos directores** que dan entrevistas de admisión, y el
grado del alumno decide cuál. Hoy ChronosLead tiene **una sola agenda por
organización**: si Mariel ocupa el martes a las 10:00, Rodrigo queda ocupado
también, aunque esté libre. La mitad de los turnos de la semana desaparece.

No es una suposición: son los dos calendarios reales que el colegio opera hoy
en Go High Level, con el mismo horario —martes, miércoles y jueves de 13:30 a
16:40— y **el mismo cupo cada uno**. Pasarlo a ChronosLead tal como está hoy
sería entregarle al cliente la mitad de lo que ya tiene.

Y hay una segunda mitad del mismo problema. Cuando se agenda una entrevista,
el aviso tiene que llegar **a quien la va a dar**, no a un número único:

| Si la entrevista es | Avisar a |
|---|---|
| hasta 3.º grado | Samantha · **Mariel** · **Lea** (psicóloga) |
| desde 4.º grado | Samantha · **Rodrigo** |

La organización tiene hoy **un solo** `alert_phone`. Avisar a tres personas,
ruteado por grado, no se puede.

## Lo que el dueño definió (18-nov-2026)

> «Esto solamente vamos a aplicarlo en el colegio Cerritos, desde la instancia
> de colegio Cerritos, no en los otros clientes. No vamos a tocar nada de los
> otros clientes. (…) no va a estar activo para los demás, sino que eso cada
> uno, o sea, yo tengo que pedir activar para los demás.»

**Ese es el requisito duro de esta spec.** Los otros ocho clientes tienen que
terminar el despliegue viendo **exactamente** lo que veían antes: la misma
pantalla de Citas, sin pestaña nueva, sin filtro, sin cambios en su agente.

Y los destinatarios, confirmados ese día: Samantha siempre; Mariel y Lea hasta
3.º; Rodrigo desde 4.º. Dan queda fuera de los avisos de ChronosLead —está en
los de Go High Level para supervisar— y lo descartó el dueño explícitamente.

## Lo que ya existe y no hay que construir

| Pieza | Dónde |
|---|---|
| El motor de huecos | `computeAvailability()` en `src/server/agenda/availability.ts` — **no se toca** |
| Reservar con garantía de oferta previa | `createSessionBooking()` en `agenda/service.ts` |
| Mover y cancelar | `rescheduleForConversation()` / `cancelForConversation()` (spec 142) |
| Avisar al equipo | `avisarDeCita()` en `src/server/ai/aviso-de-cita.ts` (142/145) |
| Recordar una hora antes | `agenda/recordatorios.ts` + `ai/recordatorio-de-cita.ts` |
| Acciones del agente | `offer_slots`, `book_slot`, `reschedule_slot`, `cancel_slot` |
| La bandera `AGENDA` | `src/server/agenda/flag.ts` |

**La cantera**: `vocero-verticales-1.3.zip` de Kevin, vertical `barberia`
(autorizado por él, MIT, confirmado por el dueño el 30-10-2026). De ahí salen
el diseño del esquema, el `pg_advisory_xact_lock` por recurso y la paleta de
colores. **No es un repositorio que se mezcle: es una fuente de donde copiar.**

## Las decisiones de diseño

### 1. El interruptor es por organización, no de despliegue

La bandera `AGENDA` que existe es una **variable de entorno**: una sola
instancia sirve a los nueve clientes, así que prenderla los prende a todos.
Para que esto sea solo Cerritos hace falta un interruptor **por organización**.

Va en `organization`, lo prende el operador desde el panel de superadmin, y
apagado el cliente no ve absolutamente nada nuevo.

**No se agrega una segunda bandera de despliegue.** Hay precedente propio en
ADR-002 («Lo que se descartó»): una bandera extra cuando la configuración ya da
el opt-in es *«ceremonia sin garantía nueva»*. El opt-in real acá es el
interruptor por organización, que además es el que el dueño quiere manejar.

### 2. Recursos sí, catálogo de servicios no

La cantera trae **dos** cosas: recursos (quién atiende) y servicios (qué se
agenda, con su duración y su precio). Cerritos necesita la primera. Las dos
entrevistas duran 30 minutos, que es la duración global que ya está
configurada, y no se cobran.

Se trae **solo `agenda_resource`**. `agenda_service` queda fuera: traer una
pantalla de catálogo con precios que ningún cliente va a llenar es exactamente
el error que la constitución llama «no reinventar lo que ya existe» al revés —
construir lo que todavía no hace falta. Cuando un cliente lo pida, entra con su
propia migración aditiva.

### 3. El grado elige el recurso, y el agente lo resuelve por criterio

Cerritos **no** deja que la familia elija director: lo decide el grado del
alumno. Pero codificar «grado» en el motor sería atar el producto a un colegio.

Cada recurso lleva un **criterio** en texto —«cuándo corresponde este
recurso»— que viaja al prompt del agente:

```
Recursos disponibles para agendar:
- Mariel Díaz — cuando el alumno va de nivel inicial o guardería hasta 3.º grado
- Rodrigo Godoy — cuando el alumno va de 4.º grado en adelante
```

El agente nombra el recurso; el servidor resuelve nombre → id con la misma
tolerancia que `resolveStage()` (exacto, después sin mayúsculas). Sin match,
degrada. Es genérico: una barbería escribiría «cuando el cliente pide a Juan».

### 4. Los avisos se suman, no se reemplazan

El destinatario de la organización (`alert_phone`) **sigue siendo el que
siempre recibe** — en Cerritos, Samantha. Cada recurso puede sumar los suyos.
Una organización sin recursos avisa exactamente como hoy: un destinatario, el
de siempre. Ese es el camino de los otros ocho clientes, y no cambia una línea
de su comportamiento.

### 5. Un bloqueo sin recurso ocupa a todos

Si el colegio bloquea el 11 de diciembre, lo bloquea para los dos directores.
Una cita **sin** `resource_id` ocupa a todos los recursos; una **con**
`resource_id` ocupa solo a ese. Es el diseño de la cantera y es el que
corresponde: las vacaciones son del colegio, no de una persona.

## Requisitos

### Datos

- **FR-01** · Tabla `agenda_resource` con `organization_id` NOT NULL: nombre,
  horario propio opcional (NULL = el del negocio), color, criterio, lista de
  destinatarios de aviso, activo, posición.
- **FR-02** · `booking.resource_id` nullable, con `on delete set null`.
- **FR-03** · El índice anti doble-booking pasa a ser **por recurso**:
  `(organization_id, coalesce(resource_id,''), scheduled_at)` con el mismo
  `where` de hoy. Con `resource_id` en NULL es **exactamente** el índice
  actual.
- **FR-04** · `organization.agenda_resources` boolean NOT NULL default
  **false**.
- **FR-05** · La migración es **aditiva** y se aplica a todas las instancias:
  tablas vacías son inertes (ADR-001).

### Disponibilidad y reserva

- **FR-06** · Con el interruptor apagado, o sin recursos activos, la
  disponibilidad y la reserva se comportan **byte por byte** como hoy.
- **FR-07** · Con recursos, los huecos se calculan **por recurso**: las citas
  de otro recurso no ocupan.
- **FR-08** · Las citas sin recurso (bloqueos) ocupan a **todos** los recursos.
- **FR-09** · Los solapes que el índice no ve (duraciones distintas) los cierra
  `pg_advisory_xact_lock` por `(organización, recurso)`.
- **FR-10** · El horario propio de un recurso manda sobre el del negocio; sin
  horario propio, hereda el del negocio.

### El agente

- **FR-11** · `offer_slots` y `book_slot` aceptan un `resource` opcional
  (nombre). `reschedule_slot` conserva el recurso de la cita.
- **FR-12** · El prompt lista los recursos activos con su criterio **solo** si
  la organización los tiene encendidos. Apagado, el prompt no gasta ni un token
  en recursos.
- **FR-13** · Un `resource` que no resuelve **degrada**, no revienta.
- **FR-14** · La oferta registrada (`offered_slot`) recuerda de qué recurso era
  el hueco: reservar un instante ofrecido para Mariel no puede terminar en la
  agenda de Rodrigo.

### Avisos

- **FR-15** · Al agendar, mover o cancelar, se avisa a **todos** los
  destinatarios: el de la organización más los del recurso de la cita.
- **FR-16** · Lo mismo para el recordatorio al equipo una hora antes.
- **FR-17** · Sin duplicados: dos destinatarios con el mismo teléfono
  normalizado reciben **un** aviso.
- **FR-18** · Un aviso que falla no tumba los demás ni la cita. Sigue valiendo
  la regla del 142: **jamás lanza**.

### La pantalla

- **FR-19** · Con el interruptor encendido, Ajustes → Agenda gana una sección
  de recursos: alta, nombre, color, horario, criterio y destinatarios.
- **FR-20** · Citas muestra las citas con el color de su recurso y un filtro
  «Todos · {recurso} · {recurso}».
- **FR-21** · Apagado, **ninguna** de las dos superficies existe.
- **FR-22** · El panel de superadmin prende y apaga el interruptor por cliente.

## Criterios de aceptación

| # | Se verifica | Cómo |
|---|---|---|
| **AC-1** | Dos citas a la misma hora, distinto recurso, **las dos entran** | E2E |
| **AC-2** | Dos citas a la misma hora, **mismo** recurso: la segunda recibe `slot_taken` con alternativas | E2E |
| **AC-3** | Un bloqueo sin recurso borra ese hueco **de los dos** | E2E |
| **AC-4** | Una organización **sin** el interruptor agenda, avisa y recuerda igual que antes del despliegue | **gate de aislamiento** |
| **AC-5** | El agente rutea por criterio: «mi hijo va a 1.er grado» termina en la agenda de Mariel | ensayo del Laboratorio |
| **AC-6** | Agendar con Mariel manda **tres** avisos (Samantha, Mariel, Lea); con Rodrigo manda **dos** | en vivo, sobre Cerritos |
| **AC-7** | Un recurso con horario propio ofrece **solo** sus horas | unitario |
| **AC-8** | El prompt de una organización sin recursos **no menciona** recursos | unitario |

## Fuera de alcance

- **El catálogo de servicios** (duración y precio por servicio) — decisión 2.
- **La puerta pública** (replicar el formulario de `admisiones2027.cerritos.edu.py`
  para que la agenda reciba citas de la web además de WhatsApp). Es la otra
  mitad del pedido del dueño y va en su propia spec: necesita un endpoint
  público, protección contra abuso y una landing. Esta spec deja la agenda
  lista para recibirla.
- **Los cuatro datos obligatorios de Cerritos** (nombre del encargado, nombre
  del alumno, grado y plan). Es configuración de instancia —prompt y
  conocimiento—, no código.
- **El cerebro externo** (`/api/bot/*`). Esa superficie sigue ofreciendo y
  reservando sobre la agenda única: un bot propio en una organización CON
  recursos crearía citas sin recurso, que ocupan a todos. No bloquea a nadie
  hoy —ningún cliente de la cartera usa cerebro externo— pero es deuda
  explícita, no un olvido.
- **La migración de las citas que hoy viven en Go High Level.**
- **El conector de Google Calendar para los directores.**
