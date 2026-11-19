# 151 · El agente consulta un servicio del negocio

**Carril: completo** — tabla nueva, acción nueva del agente, pantalla nueva.

## El problema

Los padres de The Student Store preguntan todos los días **cuánto saldo le
queda a su hijo**. Hoy eso funciona fuera de ChronosLead: el agente viejo
captura la cédula, un workflow la manda a n8n, n8n consulta PostgreSQL y
devuelve el saldo.

En ChronosLead **no se puede**, y el brief lo dice sin rodeos:

> «Ninguna de las seis acciones del agente llama a un servicio externo. **Es la
> capacidad más grande de las cuatro pendientes, y la que más valor
> desbloquea: es una capacidad general, no un arreglo para un cliente.**»

## Por qué general y no un conector de saldo

Un «conector de saldo» serviría a un cliente. Lo que hace falta es que
**cualquier negocio pueda enseñarle al agente a preguntarle algo a su propio
sistema**: un saldo, el estado de un pedido, si una factura está paga.

El negocio lo configura una vez: a qué dirección se pregunta, qué dato hay que
capturar y dónde viene la respuesta. El agente captura ese dato y lee lo que
el servicio conteste.

## La regla que hereda del diseño actual, y es la importante

> **El modelo solo captura la cédula. El monto sale de la base, nunca del
> modelo, para que no pueda inventarlo.**

Es la misma regla que la agenda: el modelo **no redacta** el dato, lo pide y
lo pega el motor. Un saldo inventado es peor que no contestar.

## Lo que se sabe del servicio de The Student Store

| | |
|---|---|
| Dirección | `creativo4d.app.n8n.cloud/webhook/consultar-saldo` |
| Autenticación | **Header Auth** (confirmado por Dan) |
| Qué se manda | `student_ci` |
| Dónde viene la respuesta | `answer` |
| Solo lectura | sí |

Probado el 9-nov con un POST vacío: el endpoint está vivo y responde
**403 · Authorization data is wrong!** — o sea que la credencial es
obligatoria.

> **Curl primero, código después.** Está escrito en el brief y se respeta: la
> pantalla trae **«Probar conexión»**, que manda una consulta de verdad y
> enseña lo que contestó. El adaptador se termina de ajustar contra una
> respuesta real, no contra lo que suponemos.

## Decisiones

### 1. Una consulta por organización, con nombre

No un catálogo: **una**, con el nombre que el negocio le dé («el saldo del
alumno»). Cubre lo que hace falta hoy sin inventar un motor de integraciones
que nadie pidió. Si algún día hacen falta dos, la tabla ya admite más filas.

### 2. La credencial se pega en la pantalla y se guarda cifrada

Nunca por chat, nunca en el código. Mismo tratamiento que la llave de IA y las
de los conectores: cifrada en reposo, y de vuelta solo los últimos 4.

### 3. El agente captura, el motor pregunta

Acción nueva `consultar`: el modelo manda **solo el dato capturado**. La
respuesta se le entrega como hecho y él la comunica. No la calcula, no la
redondea, no la completa.

### 4. Si el servicio falla, se dice

Sin inventar un saldo ni callar. El agente avisa que no pudo consultarlo
ahora y ofrece derivar. Un tercero caído no puede volverse un número falso.

### 5. Apagada, no existe

Una organización sin consulta configurada no ve la acción en el prompt ni
gasta un token en ella. Ocho de los nueve clientes no cambian en nada.

## Requisitos

- **FR-01** · Tabla `consulta_externa` con `organization_id` NOT NULL: nombre,
  cuándo usarla, URL, método, nombre y valor **cifrado** de la cabecera de
  autenticación, campo que se manda, campo de la respuesta, activa.
- **FR-02** · Acción `consultar` del agente con el dato capturado y la
  respuesta para el cliente.
- **FR-03** · El prompt describe la consulta con su «cuándo usarla», solo si
  está configurada y activa.
- **FR-04** · El valor de la respuesta se le entrega al modelo como dato; el
  modelo **no lo inventa ni lo modifica**.
- **FR-05** · Timeout corto y un fallo que degrada con un mensaje honesto.
- **FR-06** · «Probar conexión» manda una consulta real y enseña la respuesta
  cruda, para cerrar el «curl primero».
- **FR-07** · La credencial jamás vuelve al cliente completa: últimos 4.
- **FR-08** · Sin configurar, el prompt no la menciona.

## Criterios de aceptación

| # | Se verifica | Cómo |
|---|---|---|
| **AC-1** | Configurada, el agente captura el dato y contesta con lo que devolvió el servicio | ensayo |
| **AC-2** | El servicio caído degrada con un mensaje honesto, sin número inventado | unitario |
| **AC-3** | Sin configurar, el prompt no menciona la acción | unitario |
| **AC-4** | La credencial no sale completa por ninguna ruta | unitario |
| **AC-5** | «Probar conexión» trae la respuesta real del servicio | en vivo con el de Store |

## Fuera de alcance

- **Varias consultas por organización** — la tabla lo admite, la pantalla no.
- **Autenticaciones que no sean una cabecera** (Basic, OAuth).
- **Escribir** en el sistema del negocio. Esto solo pregunta.
