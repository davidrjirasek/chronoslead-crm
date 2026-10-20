# 104 — Capa de plataforma: alta, estado y suspensión

**Feature Branch**: `feat/104-capa-de-plataforma`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código. Depende de la
[101](../101-resolucion-tenant-por-host/spec.md).

**Input**: paso 7 de la skill `saas-multitenant`, recortado por las decisiones
del operador que ya están en la constitución: **altas solo por el operador**,
**cobro fuera del sistema**, **7 días de gracia**, **sin reventa**.

**Carril**: ciclo completo. Toca el modelo de datos (tres columnas en
`organization`, con migración) y añade un script de operación.

## Problema

Hoy una organización existe o no existe, y nada más. No hay forma de dar de alta
a un cliente sin meter mano en la base, ni de dejar de servirle cuando deja de
pagar, ni de saber quién está al corriente. Sin eso, el sistema es multi-cliente
a nivel técnico pero no es un negocio operable.

## Decisiones

### El estado de pago es una fecha, no un estado

`organization.paid_through` — hasta cuándo está pagado. El operador la mueve al
cobrar. De ella se **deriva** todo lo demás:

| `paid_through` | Estado |
|---|---|
| sin fecha | **activa** — cliente nuevo o cortesía; nadie se queda fuera por un campo vacío |
| hoy o futuro | **activa** |
| vencida hace ≤ 7 días | **en gracia** — entra y funciona, con aviso |
| vencida hace > 7 días | **suspendida** |

Una fecha fija es mejor que «N días desde la primera detección»: el reloj es el
mismo lo mire quien lo mire, no depende de cuándo un proceso se dio cuenta, y no
hay reintento que lo reinicie. Es el modelo correcto **porque el cobro es
manual**; con un proveedor externo haría falta registrar la detección.

### La suspensión por impago no se guarda, se calcula

No hay tarea de fondo que suspenda. El estado se evalúa en cada petición a
partir de la fecha. Una tarea de fondo introduce una ventana en la que la base
dice una cosa y la realidad otra, y exige un cron que esta instancia no tiene.

### La suspensión manual sí se guarda, y no se levanta sola

`organization.suspended_at` + `suspended_reason`. Es para cortar a alguien por un
motivo que no es el pago (abuso, petición del propio cliente). **Pagar no la
levanta**: la quita el operador, explícitamente. Son dos causas distintas y se
resuelven por separado.

### Suspendida no pierde nada

Nadie entra —ni el dueño—, el agente no responde, pero **los webhooks se siguen
recibiendo y guardando**. Si un cliente vuelve, encuentra también los mensajes
que llegaron mientras estuvo fuera. Ninguna rutina borra ni purga datos de una
organización suspendida; el borrado solo ocurre por petición explícita de su
dueño.

### El aviso de gracia se ve dentro, y eso no basta

Desde el día que vence, un cartel en la aplicación cuenta los días que quedan. Es
el aviso que **no puede fallar**: no depende de un correo que rebota, de un
trabajo programado que no corrió ni de un proveedor caído.

Pero hay que decirlo claro, porque es su límite: **solo lo ve quien entra**. Un
cliente que no abra el CRM esa semana llega al corte igual de sorprendido. El
aviso que llega aunque no entre —correo o WhatsApp— necesita un canal y algo que
lo dispare a diario, y ninguna de las dos cosas existe todavía en esta instancia.
Entra con el cobro automático, que es cuando de verdad hace falta: un cargo que
falla sin avisar es peor que un impago sin avisar.

### El alta es un comando, no una pantalla

`pnpm provision` con `ORG_SLUG`, `ORG_NAME` y `ORG_ADMIN_EMAIL`. No hay registro
público ni autoservicio, así que no hace falta `alta.chronoslead.com` ni códigos
por correo. Cuando cierras una venta, corres el comando y le entregas el acceso.

El script es **idempotente**: correrlo dos veces con el mismo slug no crea dos
organizaciones ni rompe la existente.

La contraseña inicial se genera y se escribe en un archivo local con permisos
600, fuera del repositorio. **No se imprime en pantalla**: lo que aparece en una
terminal acaba en el historial, en una captura o en un log.

## Comportamiento esperado

| Situación | Resultado |
|---|---|
| `paid_through` sin fecha, o hoy/futuro | entra y funciona |
| Vencida hace 3 días | entra y funciona; la sesión sabe que está en gracia |
| Vencida hace 8 días | no entra: «esta cuenta está suspendida» |
| Vencida hace 8 días, llega un WhatsApp | **se guarda igual**; el agente no responde |
| `suspended_at` puesto, aunque esté pagada | no entra |
| Se paga una suspendida manualmente | **sigue sin entrar** hasta que el operador la levante |
| Reactivada | todo intacto: contactos, conversaciones, citas |
| Con `EDITION` apagada | nada de esto aplica; una instancia = un negocio |

## Criterios de aceptación

1. Con `EDITION` apagada, comportamiento idéntico al de hoy y los 1192 tests
   verdes.
2. `pnpm provision` crea organización, dueño, membresía y los datos iniciales
   que ya siembra el registro; correrlo dos veces no duplica nada.
3. El dueño recién creado entra en `{slug}.lvh.me` con la contraseña del archivo
   generado, y ve su organización vacía.
4. Mover `paid_through` a hace 8 días deja fuera a esa organización **y solo a
   esa**: la otra sigue entrando.
5. Un WhatsApp entrante a una organización suspendida **se guarda** y el agente
   **no** responde.
6. Levantar la suspensión devuelve el acceso con todos los datos intactos.
7. La contraseña generada no aparece en la salida del comando.
8. El cálculo del estado está cubierto por tests en sus bordes: día 0, día 7,
   día 8, sin fecha, suspensión manual con fecha futura.
9. Una organización en gracia ve un cartel con los días que le quedan, y una
   activa no ve nada.

## Fuera de alcance

- **Panel de superadmin web** en `admin.chronoslead.com` — spec 106. Con el
  comando y una consulta a la base se opera igual, y una pantalla que todavía no
  sabemos cómo se va a usar es trabajo que se tira.
- **El guion de aislamiento A/B automatizado** (paso 9) — spec 105, que es la
  siguiente: necesita justamente el aprovisionamiento de esta.
- **Cuotas** por organización (almacenamiento, mensajes, gasto de IA): no hay
  todavía ningún cliente cerca de un límite.
- **Adaptador de cobro**: el cobro es manual por decisión del operador.
