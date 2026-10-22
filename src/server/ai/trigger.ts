import { scheduleAgentTurn } from "@/server/ai/pipeline";
import { isAiConfiguredFor } from "@/lib/ai/provider";
import { despachoActivo } from "@/server/brains/config";
import { despacharAlCerebro } from "@/server/dispatch/encolar";
import { organizacionConServicio } from "@/server/tenant/servicio";
import { transcribirNotaDeVoz } from "@/server/ai/nota-de-voz";

/**
 * Punto de enganche del turno tras la ingesta de un mensaje entrante REAL (las
 * conversaciones del Laboratorio invocan el pipeline directamente, sin
 * debounce).
 *
 * 021 — Con un cerebro configurado (`BRAIN_DISPATCH_URL` + `BOT_API_KEY`) el
 * turno no se piensa aquí: se encola un despacho y el worker se lo entrega. Los
 * dos caminos son excluyentes: mientras el despacho está activo el agente
 * incluido no contesta, tenga o no proveedor de IA e interruptor encendido. Es
 * lo que evita la doble respuesta sin depender de que alguien se acuerde de
 * apagar uno.
 *
 * 025 — `messageId` es el entrante que provoca el turno. Quien lo lleve —el
 * despacho en su fila, el agente incluido en su coalesce— lo anota como algo
 * que DEBE: si el cliente escribe mientras se piensa la respuesta a lo
 * anterior, ese mensaje queda detrás de ella y sin la nota se da por atendido.
 */
export async function maybeRunAgentTurn(
  conversationId: string,
  organizationId: string,
  messageId: string
): Promise<void> {
  // 104 — Una organización suspendida no contesta en automático, ni por el
  // agente incluido ni por un cerebro externo. El mensaje entrante YA está
  // guardado cuando se llega aquí: se corta el servicio, no los datos.
  if (!(await organizacionConServicio(organizationId))) return;

  // 112 — Si el entrante es una nota de voz y el conector está encendido, se
  // transcribe ANTES de pensar el turno: así el agente lee lo que dijo el
  // cliente y no «llegó un audio». Sin conector vuelve enseguida.
  await transcribirNotaDeVoz(organizationId, messageId);

  if (despachoActivo()) {
    await despacharAlCerebro(conversationId, organizationId, messageId);
    return;
  }
  if (!(await isAiConfiguredFor(organizationId))) return;
  scheduleAgentTurn(conversationId, messageId);
}
