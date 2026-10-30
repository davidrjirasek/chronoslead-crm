# 136 — Gobierno del equipo de una organización

**Feature Branch**: `feat/136-gobierno-del-equipo`

**Created**: 2026-10-30

**Status**: Especificada antes de escribir código. Depende de la
[104](../104-capa-de-plataforma/spec.md), la
[106](../106-enlace-de-primer-acceso/spec.md) y la
[105](../105-guion-de-aislamiento/spec.md).

**Input**: auditoría pedida por el dueño el 2026-10-30, al notar que Ajustes →
Equipo y el panel de superadmin se estaban arreglando «de a poquito» en vez de
pensarse. Siete hallazgos, abajo.

**Carril**: ciclo completo. Toca el modelo de datos (tabla nueva, migración
aditiva), un archivo de upstream y dos superficies de la aplicación.

## Problema

Ajustes → Equipo se diseñó para Vocero: **un negocio, un dueño, dos operadores,
sin personal externo y sin correo**. El fork le cambió las cuatro premisas
—clientes con más de una empresa, operadores nuestros adentro de cada cliente, y
una constitución que prohíbe el correo transaccional— pero el panel conservó las
de antes. Por eso cada caso nuevo parece un parche: no hay modelo, hay
acumulación.

Hallazgos de la auditoría, por gravedad:

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | No existe quitar a un miembro. En ningún lado: ni panel de equipo, ni superadmin, ni base | Un empleado que renuncia conserva acceso a la Bandeja para siempre. Único recurso: suspender la organización entera |
| 2 | Un `admin` puede generar el enlace de acceso del `owner`, consumirlo y fijarle contraseña. Consumirlo **borra todas las sesiones** de la víctima | Toma de control de la cuenta, limpia, inmediata y sin rastro visible |
| 3 | `owner` no tiene ninguna facultad exclusiva: `canConfigure` lo iguala a `admin` | La insignia «Propietario» promete una autoridad que el código no respalda |
| 4 | `registrar()` es un `console.info` sin tabla | El único registro de quién generó qué enlace vive en los logs del contenedor; el cliente no ve nada |
| 5 | `POST /api/settings/team` siempre crea usuario: con un correo existente responde `409` | Un cliente con dos empresas no puede poner a su empleado en la segunda |
| 6 | Ese mismo `409` confirma si un correo está registrado | Enumeración de cuentas por un administrador autenticado |
| 7 | La tabla `invitation` existe, está conectada al plugin de Better Auth y **no se usa** | Pieza muerta: la API que la usaría está tapiada por el endurecimiento de la 105 |

## Decisiones

### Rangos, no una lista plana de permisos

`canConfigure(role)` devuelve lo mismo para `owner` y `admin`, así que el
sistema no tiene jerarquía: tiene dos clases de configurador. Se reemplaza por
un rango ordenado y **una sola regla**:

> **Nadie actúa sobre un rango igual o superior al suyo.**

| Rango | Valor |
|---|---|
| Propietario | 3 |
| Administrador | 2 |
| Miembro | 1 |

Eso cierra los hallazgos 2 y 3 de una vez: un administrador no puede quitar,
cambiar de rol ni generar el enlace del propietario ni de otro administrador.

Consecuencia aceptada: **el bloqueo del propietario siempre escala a
superadmin.** Es correcto — quien destrabe a la máxima autoridad de una cuenta
tiene que ser una autoridad por encima de ella.

### Alta unificada: si la persona ya existe, se agrega

Un solo formulario y un solo botón. La ruta deja de asumir que todo correo es
nuevo:

| Caso | Qué hace | Qué se le dice al que da el alta |
|---|---|---|
| Correo desconocido | Crea usuario + membresía | «Cuenta creada. Compartile esta contraseña temporal» |
| Correo con cuenta, sin membresía acá | Crea solo la membresía | «Ya tiene cuenta en ChronosLead: entra con su contraseña de siempre» |
| Correo ya miembro de esta organización | Nada | «Ya está en el equipo» |

**Se descartó la invitación con aceptación**, aunque la tabla exista (hallazgo
7): solo funcionaría con gente que ya tiene cuenta —es la única que puede entrar
a ver el aviso—, así que no reemplaza al alta directa, solo le agrega un paso al
único caso que hoy está roto. Un empleador que suma a su empleado a su propia
herramienta no necesita pedirle permiso; Slack y Google Workspace funcionan
igual. La tabla `invitation` queda muerta a propósito.

### La transparencia reemplaza al consentimiento

Como nadie consiente que lo agreguen, **cada persona ve en su propia cuenta a
qué organizaciones pertenece y con qué rol**. Nada queda oculto, y no se agrega
ni un clic al que da el alta.

La enumeración de correos (hallazgo 6) **se acepta**: quien la puede ejercer es
un administrador ya autenticado, lo que revela es que alguien usa ChronosLead,
y queda en la bitácora. Pagar fricción en el camino principal para taparla no se
justifica.

### Quitar es quitar la membresía, nunca borrar la persona

La constitución dice que suspender retira el servicio, nunca los datos. Borrar
el usuario dejaría las conversaciones huérfanas y —peor— sacaría a esa persona
de **las otras organizaciones donde trabaja**. Se borra la fila de `member`; el
usuario, su historial y sus demás membresías quedan intactos.

### Bitácora en tabla, y visible para el cliente

Sin correo con que avisar, la transparencia es la única defensa contra el
hallazgo 2. Tabla nueva `team_audit`: quién, qué, sobre quién, cuándo. Se
muestra en Ajustes → Equipo, para la organización en curso. `registrar()` del
panel de superadmin sigue existiendo y además escribe acá.

### El enlace de acceso baja al panel del cliente

Hoy toda recuperación escala a nosotros porque la constitución prohíbe el correo
y el único generador de enlaces vive en superadmin. El mecanismo de la 106 no
cambia —un solo uso, 7 días, hash en la base, cierra sesiones al consumirse—:
cambia **quién lo puede disparar**, gobernado por la regla de rangos.

| Se traba | Lo destraba |
|---|---|
| Miembro | Propietario o administrador |
| Administrador | Solo el propietario |
| Propietario | Solo superadmin |

### El panel de superadmin elige a quién, por nombre

`enlaceDeAcceso` filtra por rol y hace `.limit(1)` **sin `ORDER BY`**: con dos
administradores devuelve uno indeterminado. Y como generar invalida el enlace
anterior de esa persona, se le puede romper el acceso a un compañero creyendo
que uno se lo genera a sí mismo. Los botones «Para el dueño» / «Para soporte» se
reemplazan por la lista de miembros de esa organización —nombre, correo, rol— y
se genera para el que se elija, avisando que invalida el anterior de esa
persona. Superadmin no tiene límite de rango: es la autoridad de última
instancia.

### Todo detrás de `EDITION=cloud`

`api/settings/team/route.ts` y `team-client.tsx` son de upstream. Amontonarles
un sistema de identidad multitenant es conflicto permanente en cada traída. Lo
nuevo vive en módulos propios del fork y esos dos archivos solo reciben el punto
de entrada condicionado por la bandera: sin `EDITION=cloud` el panel se comporta
como el Vocero original.

## Comportamiento esperado

1. Un administrador abre Ajustes → Equipo y ve a cada miembro con su rol, y
   junto a los de rango menor: cambiar rol, generar enlace, quitar.
2. Junto al propietario y a los demás administradores **no ve ninguna acción**.
3. Da de alta un correo que ya tiene cuenta: se agrega a la organización y se le
   avisa que esa persona entra con su contraseña de siempre.
4. Quita a alguien: pierde el acceso en el acto; sus conversaciones conservan su
   nombre; sus otras organizaciones no se enteran.
5. Genera un enlace para un miembro trabado: lo copia y se lo pasa. A las 11 de
   la noche, sin nosotros.
6. Al crear una cuenta, la contraseña temporal aparece con botón de copiar y el
   aviso de que no hay recuperación; si intenta salir sin copiarla, se le
   advierte.
7. Cualquier persona ve en su cuenta a qué organizaciones pertenece.
8. Todo lo anterior queda en la bitácora visible del cliente.

## Criterios de aceptación

- [ ] Un `admin` que intenta quitar, cambiar de rol o generar el enlace de un
      `owner` o de otro `admin` recibe `403`, **también llamando la ruta
      directamente** — no solo con el botón escondido
- [ ] Un `member` que llama cualquiera de esas rutas recibe `403`
- [ ] Quitar a alguien elimina su fila de `member` y **ninguna otra**: el
      usuario, sus mensajes y sus demás membresías siguen ahí
- [ ] El alta con un correo existente devuelve `201` y crea solo la membresía,
      sin tocar la contraseña de esa persona
- [ ] El alta con alguien que ya es miembro no duplica la fila
- [ ] Toda ruta nueva pasa por `scoped()`: un administrador de A no puede
      nombrar un `userId` o un `memberId` de B
- [ ] El guion de aislamiento (105) sigue verde, con comprobaciones nuevas para
      cada punto de arriba
- [ ] Sin `EDITION=cloud` el panel se comporta como el Vocero original
- [ ] La bitácora registra cada alta, baja, cambio de rol y enlace generado

## Fuera de alcance

- **Ceder la propiedad.** Decisión del dueño del 2026-10-30: es poco frecuente y
  se atiende caso por caso desde superadmin cuando un cliente lo pida
- **Invitación con aceptación.** Descartada arriba; la tabla `invitation` queda
  sin usar
- **Correo transaccional.** Lo prohíbe la constitución (Soberanía II)
- **Auto-servicio de «olvidé mi contraseña» sin nadie que lo autorice.** Sin
  correo no hay forma de probar que quien lo pide es el dueño del buzón
