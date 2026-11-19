# 150 · El camino de vuelta

**Carril: completo** — tabla nueva, acción nueva del agente, y una plantilla
que Meta tiene que aprobar.

## El problema

Todos los días los padres de The Student Store cargan saldo por transferencia
y le mandan al agente **la foto del comprobante**. Lo que necesitan está
escrito en su brief desde el 4-nov-2026, en la sección que se llama **«Lo que
lo bloquea»**:

> - el agente reciba la imagen
> - se la haga llegar a **Rodney**
> - Rodney verifique en el sistema y confirme
> - **el agente le avise al padre que el saldo quedó cargado**

Y el diagnóstico, textual:

> «Hoy la derivación es **de ida**: el agente escala y se corre. Esto necesita
> un **camino de vuelta** — una persona que responde y un agente que retoma la
> conversación.»

Recibir la imagen se resolvió el 19-nov (spec 149). Falta todo lo demás.

**Es lo que más necesitan y lleva meses sin resolverse.**

## Las dos decisiones del dueño (19-nov-2026)

Se le preguntaron juntas porque cambian qué se construye:

| | Decisión |
|---|---|
| Cómo ve Rodney el comprobante | **Un enlace a la conversación en ChronosLead** |
| Cómo confirma | **Contestando por WhatsApp**, con un código corto |

La primera evitó un trabajo con mal olor: mandarle la foto por WhatsApp exige
enviar adjuntos por Zernio —no implementado— y eso significa **publicar
comprobantes bancarios en URLs accesibles desde fuera**. El enlace lo deja
mirar la foto dentro de la plataforma, en contexto y con su sesión.

La segunda lo deja trabajar donde ya trabaja. No tiene que aprender una
pantalla para decir «entró».

## Lo que encontré mirando, y hay que arreglar igual

**Hoy el agente le contestaría a Rodney.** Las conversaciones que se crean para
mandar un aviso nacen con `ai_enabled` en true, así que si quien recibe un
aviso responde, el turno del agente corre y lo trata como a un cliente.

No es un detalle de esta spec: es la diferencia entre un canal de verificación
y un agente discutiendo con el administrativo. **Quien recibe avisos no es un
lead, y su conversación no es una conversación de venta.**

## Lo que ya existe y no hay que construir

| Pieza | Dónde |
|---|---|
| Recibir y guardar el comprobante | spec 149 |
| Avisar por WhatsApp a alguien del equipo | `avisarDeCita()` / `aviso-de-atencion.ts` |
| Plantillas y su estado de aprobación | `src/server/whatsapp/templates.ts` |
| Pausar y retomar la IA de una conversación | `conversation.ai_enabled` / `handoff_at` |
| Que el agente pida datos antes de actuar | el patrón de la agenda |

## Cómo funciona, de punta a punta

1. El padre manda el comprobante. El archivo ya se guarda.
2. El agente **pregunta lo que falta**: nombre y grado del alumno y, si es para
   varios hijos, cuánto a cada uno. El brief es explícito: *«no hay que
   adivinarlo ni calcularlo: hay que preguntarlo»*.
3. Con los datos, el agente abre una **verificación** y le dice al padre que la
   está confirmando. La verificación nace con un **código corto** (`A7`).
4. Rodney recibe un aviso por WhatsApp: el código, de quién es, los datos, y
   **el enlace a la conversación**.
5. Rodney mira el comprobante en el enlace, lo busca en Itaú y contesta
   **`A7 ok`** o **`A7 no llegó`**, con un comentario si quiere.
6. El agente **retoma** y le avisa al padre.

## Decisiones de diseño

### 1. El código es la llave, y es corto a propósito

Tres caracteres que una persona tipea sin pensar. Hace falta porque a Rodney le
pueden llegar varios comprobantes seguidos y un «ok» suelto no dice a cuál.

Único **entre las verificaciones abiertas** de esa organización, no para
siempre: así se reciclan y nunca crecen a algo que haya que copiar y pegar.

### 2. La respuesta de Rodney se lee ANTES del turno del agente

Mismo orden que la transcripción de notas de voz (112): primero se interpreta,
después se piensa. Si un mensaje de quien verifica resuelve una verificación
abierta, **ahí termina**: no es materia del agente.

### 3. Quien recibe avisos no conversa con el agente

Su conversación nace con la IA apagada. Vale para todos los avisos, no solo
para este flujo.

### 4. Si la ventana del padre se cerró, no se miente

Rodney suele tardar minutos, así que lo normal es contestar en texto libre.
Si pasaron más de 24 horas, se usa plantilla; y si no hay plantilla aprobada,
la verificación queda resuelta y **visible en la bandeja**, sin inventar que se
avisó. Vale la regla del 142: no se declara enviado lo que no se envió.

### 5. Una verificación no caduca sola

Si Rodney no contesta, queda abierta y se ve. Cerrarla por tiempo sería
decirle al padre algo que nadie verificó.

## Requisitos

- **FR-01** · Tabla `verificacion` con `organization_id` NOT NULL: conversación,
  mensaje del comprobante, código, resumen, estado, quién la resolvió y cuándo.
- **FR-02** · Acción nueva del agente para abrir una verificación, con el
  resumen para quien verifica y la respuesta para el cliente.
- **FR-03** · El aviso a quien verifica lleva código, datos y **enlace a la
  conversación**.
- **FR-04** · Un mensaje entrante de quien verifica que empiece con un código
  abierto resuelve esa verificación y **no llega al agente**.
- **FR-05** · Se aceptan al menos `ok`, `sí`, `entró`, `llegó` como
  confirmación y `no` como rechazo, sin distinguir mayúsculas ni acentos.
- **FR-06** · Al resolverse, el agente le avisa al cliente, con el comentario
  de quien verificó si lo hubo.
- **FR-07** · Las conversaciones creadas para avisos nacen con la IA apagada.
- **FR-08** · Sin ventana ni plantilla, la verificación se resuelve igual y
  queda a la vista; **nunca se declara avisado lo que no salió**.
- **FR-09** · Una organización sin verificaciones no cambia en nada.

## Criterios de aceptación

| # | Se verifica | Cómo |
|---|---|---|
| **AC-1** | Un código abierto + «ok» resuelve y dispara el aviso al cliente | E2E |
| **AC-2** | Dos verificaciones abiertas a la vez se resuelven cada una por su código | E2E |
| **AC-3** | Un mensaje de quien verifica que NO empieza con código sigue su curso | unitario |
| **AC-4** | Quien recibe un aviso no recibe respuesta del agente | E2E |
| **AC-5** | Sin plantilla ni ventana, queda resuelta y sin aviso falso | unitario |
| **AC-6** | Una organización sin verificaciones agenda y avisa igual que antes | aislamiento |

## Dependencia con plazo

El aviso a quien verifica es **iniciado por el negocio**: fuera de la ventana
de 24 horas necesita **una plantilla aprobada por Meta**. Aprobar una lleva su
tiempo y no depende de nosotros, así que se crea y se manda a revisión **al
empezar**, no al final.

## Fuera de alcance

- **Consultar el saldo** contra la plataforma del cliente.
- **Tomar pedidos de comida** — la segunda etapa del brief, a propósito.
- **Mandarle la foto por WhatsApp a quien verifica** — exige adjuntos
  salientes por Zernio, con URLs públicas de comprobantes bancarios.
- **Detectar que pagaron en la cuenta del Colegio por error.** Lo pide el
  brief; es una regla de conocimiento, no de este motor.
