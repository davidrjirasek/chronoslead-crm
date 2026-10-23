# 117 · Aviso de atención humana

**Carril: completo** — toca el modelo de datos (dos columnas nuevas).

## El problema

Cuando una conversación necesita a una persona, hoy **no se entera nadie**. El
CRM lo marca en la bandeja y publica un evento por SSE, pero si nadie está
mirando la pantalla en ese momento, el cliente espera hasta que alguien pase.

Las escaladas que más valen son justo las que ocurren fuera de hora: un
director de colegio preguntando por el servicio de comedor es un contrato
entero, y depende de que alguien mire la bandeja.

## Lo que ya existe y no hay que construir

| Pieza | Dónde |
|---|---|
| El único punto por donde pasa toda escalada | `applyHandoff()` en `src/server/ai/pipeline.ts` |
| La plantilla aprobada por Meta | `aviso_atencion_humana`, 4 variables |
| Teléfono → contacto | `getOrCreateContactByIdentity()` |
| Contacto → conversación | `getOrCreateConversation()` |
| Conversación + plantilla → enviado | `sendTemplate()` |

El aviso es una **composición** de esas piezas, no código nuevo.

## El hallazgo que define el diseño

La acción de escalar del modelo ya lleva el motivo en palabras
(`actions.ts:23`, `reason: z.string().optional()`) **y el pipeline lo
descarta**. Guardarlo da la «categoría» del aviso sin construir ninguna
taxonomía: el modelo escribe «quiere agendar una visita a la propiedad» o
«un proveedor espera respuesta por pagos», y eso va tal cual en el aviso.

**Por qué importa que no haya lista de categorías:** una lista queda corta ante
el motivo número cinco que a nadie se le ocurrió, y mantenerla es trabajo
permanente. El modelo ya sabe decirlo.

## Alcance de esta vuelta

- **Un destinatario por organización.** Cada aviso es una conversación que Meta
  cobra; con cuatro destinatarios, cada escalada cuesta cuatro. Decisión del
  dueño: empezar con uno.
- **Todos los avisos al mismo número.** Sin ruteo por tipo.

### Fuera de alcance, anotado

| Qué | Por qué no ahora |
|---|---|
| Varios destinatarios por organización | Multiplica el costo por conversación |
| Ruteo por tipo (pagos → administración, visitas → ventas) | Necesita taxonomía, reglas y pantalla |
| **Destinatario de plataforma** (que la agencia se entere de las escaladas de TODOS sus clientes) | Es otro concepto: no es por organización, es transversal. Práctica que el dueño ya tenía en otra herramienta y quiere recuperar |

## Modelo de datos

```
conversation.handoff_note   text NULL   -- las palabras del modelo
organization.alert_phone    text NULL   -- a quién avisar. NULL = sin avisos
organization.alert_name     text NULL   -- su nombre, para el {{1}} de la plantilla
```

`alert_phone` en NULL **apaga la función**: una organización sin configurar no
manda avisos y no falla. Es el valor por defecto de todo cliente nuevo.

## Comportamiento

1. Una conversación escala por cualquier motivo
2. Si `alert_phone` está vacío → no pasa nada
3. Si la plantilla `aviso_atencion_humana` no está aprobada → no pasa nada
4. Si no → sale un WhatsApp al número configurado con las cuatro variables:
   a quién se avisa, quién espera, a qué hora, y **por qué** (palabras del
   modelo, o el motivo técnico si no las hay)

### Las dos reglas que no se pueden romper

**Un aviso por escalada, no uno por mensaje.** `applyHandoff()` escribe en la
base cada vez que se lo llama, sin mirar si ya había escalado. Sin un guardián
de transición, un cliente que manda cinco mensajes genera cinco avisos. Solo
avisa el paso de «sin handoff» a «con handoff».

**Que el aviso falle jamás puede tumbar el turno.** Si Meta rechaza, si la
plantilla desapareció, si el número está mal: se registra y se sigue. El
cliente que está conversando no se entera. Es la misma regla que la agenda, que
nunca deja caer un turno porque un conector falló.

## Criterios de aceptación

- [ ] Una organización sin `alert_phone` escala igual y no manda nada
- [ ] Una escalada manda **exactamente un** aviso, aunque el cliente siga escribiendo
- [ ] El aviso lleva las palabras del modelo cuando las hay
- [ ] Sin palabras del modelo, lleva el motivo técnico en castellano legible
- [ ] Un fallo al enviar el aviso no afecta la conversación del cliente
- [ ] El aviso NO se manda en conversaciones del Laboratorio (`is_test`)
- [ ] Reactivar la IA y volver a escalar manda un aviso nuevo: es otra escalada
