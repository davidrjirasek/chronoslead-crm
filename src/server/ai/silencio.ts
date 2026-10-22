/**
 * 112 — Cuándo el agente tiene que callarse.
 *
 * `applyHandoff` acepta cinco motivos y los trataba a todos igual: marcaba la
 * conversación y el agente no volvía a hablar. Pero en cuatro de los cinco
 * **nadie tomó la conversación** — solo se apagó sola:
 *
 * | Motivo         | Qué pasó                         | ¿Alguien entró? |
 * |----------------|----------------------------------|-----------------|
 * | `manual_reply` | Una persona contestó de verdad   | Sí              |
 * | `cliente`      | El cliente pidió un humano       | No, todavía     |
 * | `modelo`       | El agente decidió escalar        | No              |
 * | `error`        | Falló el proveedor de IA         | No              |
 * | `ventana`      | Se cerró la ventana de 24 h      | No              |
 *
 * La regla la fijó el dueño, y el caso que la motiva es el suyo: su
 * conversación murió por `error` y él mandó tres mensajes de texto más. Con
 * esta regla, esos tres lo habrían despertado — el audio se perdía igual, pero
 * la conversación seguía viva.
 *
 * Que el agente **no insista** después de escalar es otra cosa, y se resuelve
 * donde corresponde: en las reglas de escalado del perfil. Esto decide si
 * puede hablar, no si debe.
 *
 * La marca de atención humana no se toca: `handoffAt` se sigue poniendo en los
 * cinco casos y la bandeja los sigue mostrando. Lo único que cambia es quién
 * puede seguir contestando mientras tanto.
 */

/** El único motivo por el que ya hay una voz humana en la conversación. */
export const MOTIVO_CON_HUMANO = "manual_reply";

/**
 * ¿El agente tiene que quedarse callado en esta conversación?
 *
 * Solo cuando una persona respondió de verdad: dos voces contestando es peor
 * que una. En los demás casos la conversación está marcada para que alguien la
 * atienda, pero mientras nadie llegue, el agente sigue disponible.
 */
export function agenteSilenciado(
  handoffAt: Date | string | null,
  handoffReason: string | null
): boolean {
  if (!handoffAt) return false;
  return handoffReason === MOTIVO_CON_HUMANO;
}
