# 140 — El ensayo: hablar con el agente sin tocar a nadie

**Feature Branch**: `140-ensayo-del-laboratorio`

**Created**: 2026-11-07

**Status**: Especificada antes de escribir código.

**Input**: pedido del dueño el 7-nov-2026, al ver que íbamos a cargar las bases
de conocimiento de nueve clientes sin forma de verificarlas.

**Carril**: medio. Sin migración: reusa `conversation.isTest`, que ya existe.

## Problema

El Laboratorio **no sirve para probar contenido**. Lo dice la bitácora desde el
29-oct, con la corrección del dueño:

> Corre personas fijas con guiones genéricos —una pregunta el precio de un
> martillo— y las evalúa un juez. Prueba **comportamiento**. Para verificar
> precios o encuadre, hay que escribirle por WhatsApp.

Eso era tolerable mientras no hubiera clientes. Ahora no:

1. **Van nueve bases de conocimiento**, con precios, horarios y políticas
   sacados de los mega briefs. Cargarlas sin poder verificarlas es cargar a
   ciegas y revisar nueve veces después.
2. **Los números ya son reales.** Hasta hoy «escribile por WhatsApp» costaba
   poco. Desde hoy significa mandar mensajes de prueba al número real de un
   cliente, con su agente activo y su historial de conversaciones.

Y el error que esto previene está documentado en el manual de alta (§7): un
precio que el modelo «parafrasea, redondea o mezcla» es un precio inventado.
Sin forma de preguntarle al agente, ese error se descubre cuando lo comete
delante de un cliente.

## Lo que YA existe (y por eso esto es chico)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Conversación de prueba | `conversation.isTest` | La marca que separa lo de mentira de lo de verdad |
| **El turno real del agente** | `runAgentTurn(conversationId)` | Corre con su prompt, su base de conocimiento y sus acciones |
| **El guardián** | `prepareSend` → `sandbox_violation` | Una conversación `is_test` que intente salir a WhatsApp **lanza**. No es configuración: es constitución |
| La bandeja limpia | `inbox/queries.ts` | Ya filtra `isTest` |
| Los números limpios | `analytics/shared.ts` | Resultados ya excluye el Laboratorio |

El Laboratorio hace **exactamente esto** en `runner.ts`: inserta una línea del
guion, llama a `runAgentTurn`, repite. Un ensayo es lo mismo con las líneas
escritas por una persona, de a una.

## Decisiones

### D1 · Una conversación de ensayo por organización, reiniciable

No una por sesión ni una por pregunta. Una sola, persistente, con un botón que
la vacía. Razones: se puede retomar una prueba al día siguiente, el historial
corto es parte de lo que se prueba (el agente usa el contexto), y no deja
basura acumulada.

Su contacto es fijo y reservado: `5210000000000`, el hueco que dejan las
personas del Laboratorio (que usan `…0001` a `…0005`), con nombre
`[Ensayo] Vos`. Archivado, como los del Laboratorio, para que no aparezca en
Contactos.

### D2 · El turno corre sincrónico, y la pantalla espera

El Laboratorio corre en segundo plano porque son cinco personas con guiones
largos. Un ensayo es un mensaje: se llama a `runAgentTurn` y se devuelve la
transcripción ya con la respuesta. Más simple de construir y de entender, y el
operador ve el resultado sin refrescar.

### D3 · Se muestra si el agente escaló, y por qué

Es lo que más se va a querer verificar al cargar conocimiento: que derive
cuando corresponde y que **no** derive cuando no. Hoy eso solo se ve mirando la
conversación en la bandeja, que es justo donde estas conversaciones no
aparecen.

### D4 · El guardián no se toca

`runAgentTurn` persiste la respuesta sin enviarla, y el sender lanza si algo lo
intenta. Esta feature **se apoya** en eso; no lo modifica ni lo rodea. Si
alguna vez un ensayo manda un mensaje real, el fallo está en el guardián, no
aquí.

### D5 · Sin IA configurada, se dice

`runAgentTurn` vuelve sin hacer nada si la organización no tiene llave de IA.
Sin un aviso explícito, el operador escribe y no pasa nada: parece roto. Se
comprueba antes y se dice con el enlace a Ajustes → IA.

## Qué NO hace

- **No reemplaza al Laboratorio.** Aquel prueba comportamiento con un juez;
  este prueba contenido con una persona. Son complementarios.
- **No prueba la entrega.** Que el agente conteste bien no dice que WhatsApp
  esté conectado. Para eso está Ajustes → Estado.
- **No es un canal.** No entra en Resultados, ni en la bandeja, ni en el
  pipeline.

## Verificación

Gate completo más el de aislamiento. Y una comprobación propia que importa: el
ensayo de una organización **no** puede ver ni escribir el de otra.
