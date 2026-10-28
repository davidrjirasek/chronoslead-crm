# Dar de alta un cliente en ChronosLead

Para cualquiera del equipo, con Claude Code al lado. **Seguir el orden**: varios
pasos dependen del anterior, y uno de ellos (el 2) es invisible hasta que algo
falla.

El ejemplo trabajado es Creativo 4D Group, la primera instancia. El contenido
comercial de cada cliente **vive fuera de este repo**, que es público.

---

## Antes de empezar

| Hace falta | Para qué |
|---|---|
| Acceso al panel de superadmin (`admin.chronoslead.com`) | Crear el cliente |
| Acceso a Coolify | El paso 2, el que se olvida |
| **El correo del cliente** | Queda como propietario de su cuenta (paso 1) |
| **El correo de nuestro operador** | Entra como administrador y es quien configura (paso 1) |
| Los correos de la gente del cliente | Los crea el propio cliente, cuando quiera |
| Un identificador acordado con el cliente | Es su dirección, y **cambiarlo después es mudanza** |

### El identificador (el «slug»)

Es lo que va antes del punto: `creativo-4d-group`.chronoslead.com

- **3 a 30 caracteres**, minúsculas, números y guiones
- Sin guion al principio ni al final
- No puede ser una palabra reservada: `www`, `admin`, `alta`, `api`, `app`,
  `mail`, `smtp`, `imap`, `static`, `assets`, `cdn`, `status`, `soporte`,
  `ayuda`, `blog`, `docs`, `panel`

Elegilo con el cliente antes de crear nada. Es la dirección que va a usar su
equipo todos los días y la que va en los materiales.

### Identificadores que NO se aceptan, aunque el cliente insista

**El sistema rechaza solo los que lo romperían** (`admin`, `api`, `coolify` y
los demás reservados). El resto es criterio nuestro, y hay uno que conviene
tener claro:

> **No se registran marcas ajenas.** Ni `nike`, ni `chatgpt`, ni `claude`, ni
> `hostinger`, ni el nombre de ningún producto que no sea del cliente.

**El motivo no es cortesía: es exposición legal nuestra.** El dominio
`chronoslead.com` es de Creativo 4D. Si alguien publica
`nike.chronoslead.com`, **el reclamo por uso de marca le llega al dueño del
dominio, no al cliente.**

Si el cliente de verdad se llama así —existe una ferretería «Nike» en algún
lado—, se usa una variante que no se confunda: `nike-py`, `ferreteria-nike`.
Dos minutos de conversación, y evita un problema que no es técnico y no se
arregla desplegando.

---

## 1 · Crear la organización

En `admin.chronoslead.com`, el formulario de alta pide cuatro cosas:

| Campo | Qué va |
|---|---|
| Identificador | El slug acordado |
| Nombre | El nombre comercial, como lo escribe el cliente |
| Correo del dueño | **El del cliente.** Queda como propietario de SU cuenta |
| Correo de soporte | **El de nuestro operador.** Entra como administrador |

Apretá alta. La organización y los **dos usuarios** quedan creados de una vez.

### Por qué dos, y por qué cada uno en su lugar

El sistema tiene tres roles dentro de cada organización:

| Rol | Qué puede | Cuántos |
|---|---|---|
| **Propietario** | Todo, incluido crear cuentas de equipo | Uno: el cliente |
| **Administrador** | Configurar: llave de IA, agente, conocimiento, agenda, canales | Los que hagan falta |
| **Miembro** | Solo atender la bandeja | Los que hagan falta |

**La cuenta es del cliente.** Sus conversaciones son suyas, y si algún día
termina la relación, borra el usuario de soporte y se queda con todo. Una
salida limpia es señal de un buen contrato.

**Nuestro operador entra como administrador** porque ChronosLead se vende como
servicio gestionado: nosotros configuramos y ajustamos el agente. Eso no lo
puede hacer un miembro.

> **Un mismo correo sirve para todos los clientes.** La sesión resuelve a qué
> organización pertenece por el subdominio que se abre, así que
> `sara@creativo4dgroup.com` puede estar en The Student Store y en Castel
> Muebles a la vez y ver el CRM correcto en cada dirección. No hacen falta
> alias ni correos distintos por cliente.

### Decirle al cliente que tenemos acceso

**Nuestro equipo queda con acceso permanente a las conversaciones de ese
cliente.** Es lo que hace falta para darle soporte, y es correcto — pero
**tiene que estar dicho en la propuesta o el contrato.** Un cliente que lo sabe
de entrada no tiene problema; uno que lo descubre después, sí.

La ventaja de este modelo: **ese acceso tiene nombre propio y se ve.** El
cliente entra a Ajustes → Equipo y ahí está, con el rol que tiene. No es un
permiso escondido.

> **El nombre se ve.** Aparece en la pantalla del cliente y en los correos.
> «The Student Store» no es lo mismo que «Student Store»: escribilo como la
> empresa lo escribe, con sus mayúsculas.

---

## 2 · Agregar el dominio en Coolify ⚠️

**Este es el paso que se olvida, y sin él el cliente no puede entrar.**

El cliente ya existe en la base de datos, pero su dirección todavía no funciona.
El DNS deja pasar cualquier subdominio, pero **el proxy de Coolify tiene una
lista de dominios escrita a mano**, y un subdominio que no esté en esa lista
contesta:

```
HTTP/2 503    no available server
```

No es un error de la aplicación. La aplicación ni se entera: el pedido muere en
la puerta. Por eso la pantalla «esta instancia no existe» **nunca se ve** en
este caso, y por eso cuesta tanto diagnosticarlo si no se sabe.

**Qué hacer:**

1. Entrá a Coolify → proyecto `chronos-lead` → entorno `production` →
   aplicación `chronoslead-crm`
2. **Domains** → agregá `https://<slug>.chronoslead.com` a la lista
3. Guardá y **desplegá** (en Coolify los dominios y las variables solo entran
   con un *deploy*, no con un *restart*)

**Comprobalo antes de seguir.** Con Claude Code al lado, o desde una terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<slug>.chronoslead.com/api/health
```

- `200` → bien, seguí
- `503` → el dominio no entró en la lista, o falta desplegar

> **Ojo con el despliegue:** cambia el contenedor, y durante unos 30 segundos
> el servidor contesta de forma intermitente (medido: 29 s, la mitad de los
> pedidos con error). Si hay clientes con conversaciones vivas, hacelo en un
> momento tranquilo. Detalle en [bitacora.md](bitacora.md).

> **Coolify borra el `www.` solo… y a veces lo agrega solo.** Si aparece
> `www.<slug>.chronoslead.com`, borralo: dos etiquetas antes del dominio se
> rechazan a propósito.

---

## 3 · Entregar el enlace de primer acceso

En el panel, al lado del cliente, **generá el enlace de acceso**.

| | |
|---|---|
| Dura | **7 días** |
| Se usa | **una sola vez** |

**Son dos enlaces, uno por usuario**: el del cliente y el de nuestro operador.
Cada uno elige su propia contraseña. Si uno se vence o ya se usó, se genera
otro: no pasa nada.

> **No le mandes una contraseña a nadie.** El enlace existe justo para que
> nadie —ni vos— tenga que manejar la contraseña de otro.

**Si el operador ya tiene cuenta de otro cliente, no necesita enlace:** entra
con la misma contraseña de siempre, en la dirección de este cliente. Un correo
sirve para todas las organizaciones donde es miembro.

---

## 4 · Primera entrada, y las cuentas del equipo del cliente

**Nuestro operador entra** con su enlace (o con su contraseña de siempre, si ya
tenía cuenta) y queda listo para configurar los pasos 5 a 10.

**El cliente entra** con el suyo y elige su contraseña.

### Las cuentas de la gente del cliente las crea él

Como es el propietario, **puede sumar a su propio equipo sin pedirnos nada**:
Ajustes → Equipo → Crear cuenta de equipo.

| | |
|---|---|
| Qué pide | Nombre, correo y qué va a poder hacer |
| Los dos roles que puede dar | **Atender la Bandeja** (miembro) o **Atender y configurar** (administrador) |
| Qué devuelve | Una contraseña temporal, **que se muestra UNA sola vez** |
| Cómo se entrega | Se la pasa él directamente. El sistema no manda correos |

> **La contraseña temporal se muestra una vez y no se puede volver a ver.**
> Hay que copiarla y entregarla en el momento.

**Conviene mostrarle esta pantalla durante el alta**, aunque todavía no sume a
nadie. Que sepa que puede hacerlo solo evita que cada empleado nuevo sea una
llamada a nosotros — y de paso ve ahí nuestro usuario de soporte, con su rol a
la vista.

---

## 5 · La llave de IA

**Ajustes → IA.** Cada organización tiene la suya, y se guarda cifrada.

1. Elegir proveedor y modelo
2. Pegar la llave del cliente
3. **Probar conexión** — no sigas sin que dé verde

> Quién paga la IA se define en la venta. Si la llave es del cliente, la pega
> él; si es nuestra, la pegamos nosotros. En los dos casos vive acá, no en el
> código.

---

## 6 · El agente

**Ajustes → IA**, en la sección del agente: nombre, tono, instrucciones,
escalado y saludo.

> **El campo Tono es de una sola línea y se come los saltos.** Escribilo
> corrido, con comas. Si pegás un texto con renglones, se pierde el formato sin
> avisar.

El escalado es lo que más se toca después. La regla que pidió el dueño:
**el agente avisa que hay una persona disponible, pero no se apaga.** Solo se
calla cuando una persona contesta de verdad.

---

## 7 · La base de conocimiento

Dos lugares, y confundirlos es el error más caro:

| Va en… | Qué |
|---|---|
| **Bloques y preguntas/respuestas** | Los **datos duros**: precios, horarios, políticas, qué incluye cada plan |
| **Instrucciones del agente** | Cómo se comporta: tono, orden de la conversación, qué preguntar primero |

**Por qué los datos duros no van en las instrucciones:** las instrucciones las
lee el modelo como «cómo ser», y ahí un precio se vuelve negociable — lo
parafrasea, lo redondea, lo mezcla. En la base de conocimiento es un dato que
busca y cita. Un precio en el lugar equivocado es un precio inventado.

---

## 8 · La agenda

**Ajustes → Calendario**: franjas, duración, respiro entre reuniones, aviso
previo y ventana.

> **La zona horaria nace en `America/Mexico_City`.** Para Paraguay hay que
> cambiarla a `America/Asuncion`. **Si no la cambiás, el agente ofrece horarios
> corridos** y el cliente se entera cuando alguien no aparece a la reunión.

---

## 9 · El conector de reunión

Zoom o Google Calendar, según lo que use el cliente. Guía completa en
[agenda-conectores.md](agenda-conectores.md).

**Trampas de Zoom, aprendidas a los golpes:**

- Zoom llama `:admin` a sus permisos. Buscá los que terminan así, no los otros
- **El cuarto permiso es el que rompe «Probar»**. Si falla la prueba de
  conexión, es ése: revisá que estén los cuatro

> **El Zoom creado por la API no aparece en el Google Calendar del cliente**
> aunque tenga la sincronización encendida: esa sincronización solo levanta las
> reuniones creadas a mano. Avisáselo al cliente para que no lo descubra solo.

---

## 10 · Los canales

**WhatsApp primero**, que es el que sostiene todo.

**Ajustes → WhatsApp.** El cliente comparte su cuenta de WhatsApp Business desde
su Business Manager, y de ahí salen el identificador del número y el token, que
se pegan acá. **El webhook lo registra el CRM solo al guardar** — eso no hay que
hacerlo a mano.

> El botón que hace todo esto solo (Embedded Signup) necesita el estatus de
> Tech Provider de Meta, que todavía no tenemos. Hasta entonces, es a mano.

**Instagram y Messenger** van por Zernio. **Una sola API key de Zernio sirve
para los dos** — la llave es de la cuenta, no de la red. El CRM da de alta el
webhook en Zernio al conectar, limitado a las cuentas de ese negocio.

> **Los comentarios de publicaciones no entran**, solo los mensajes directos. En
> campañas de Meta buena parte de la interacción son comentarios: decíselo al
> cliente antes de que lo note.

---

## 11 · El Laboratorio, antes de encender

Corré el Laboratorio y mirá los resultados con el cliente.

**Qué mide de verdad:** si el agente **se inventa** cosas. Eso es valioso y es
real.

> **Qué NO mide todavía:** las seis personas simuladas traen guiones de una
> ferretería —preguntan por martillos y pintura—. **A cualquier cliente le van a
> aparecer esos mismos clientes simulados.** No mide el comportamiento comercial
> propio del negocio. Explicáselo antes de mostrar el resultado, o va a parecer
> un error.

---

## 12 · Encender, y la primera semana

Encendé el agente y **mirá las conversaciones reales todos los días la primera
semana**. Es donde aparece lo que ni el Laboratorio ni las pruebas ven.

Qué revisar:

- ¿Contesta a todos? Un entrante sin respuesta es la señal más importante
- ¿Escala cuando debe, y sigue disponible después de escalar?
- ¿Los precios que dice son los de la base de conocimiento?
- ¿Las reuniones que agenda existen de verdad en el calendario?
- ¿Las notas de voz las entiende? (si el conector de transcripción está activo)

---

## Lista de control

```
[ ]  1 · Organización creada en admin.chronoslead.com
[ ]  2 · Dominio agregado en Coolify Y DESPLEGADO  ← el que se olvida
[ ]  2 · Comprobado: /api/health devuelve 200
[ ]  3 · Dos enlaces de acceso generados: el del cliente y el de nuestro operador
[ ]  4 · Los dos entraron y eligieron su contraseña
[ ]  4 · Mostrada al cliente la pantalla de Equipo: puede sumar a su gente solo
[ ]  4 · Avisado al cliente: tenemos acceso a sus conversaciones para dar soporte
[ ]  5 · Llave de IA cargada y «Probar conexión» en verde
[ ]  6 · Agente: nombre, tono, instrucciones, escalado, saludo
[ ]  7 · Base de conocimiento: los datos duros NO en las instrucciones
[ ]  8 · Agenda configurada Y zona horaria corregida (no Mexico_City)
[ ]  9 · Conector de reunión conectado y «Probar» en verde
[ ] 10 · WhatsApp conectado y probado con un mensaje real
[ ] 10 · Instagram y Messenger, si se vendieron
[ ] 11 · Laboratorio corrido y explicado al cliente
[ ] 12 · Agente encendido, y revisión diaria la primera semana
```
