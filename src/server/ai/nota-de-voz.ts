import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { ensureAssetAvailable } from "@/server/whatsapp/media";
import {
  transcribirAudio,
  transcripcionDisponible,
} from "@/server/ai/transcripcion";

/**
 * 112 — El enganche: transcribir la nota de voz ANTES de que el agente piense.
 *
 * Va en `maybeRunAgentTurn`, entre la ingesta y el turno, por una razón de
 * orden: si transcribiera en paralelo, el turno podría leer el mensaje todavía
 * sin texto y contestar como si no hubiera entendido nada. Aquí el texto ya
 * está cuando se arma el historial.
 *
 * El resultado se guarda en `message.text`. Eso hace que TODO lo de aguas
 * abajo funcione sin tocar nada más: el agente lo lee como cualquier mensaje
 * (`contenidoParaElModelo` prefiere el texto), y en la bandeja la persona ve
 * el reproductor **y** lo que la nota decía, que es justo lo que necesita para
 * decidir si entra.
 *
 * Nunca lanza y nunca demora de más: si no hay conector, si el audio no bajó o
 * si el proveedor falla, se vuelve en silencio y el mensaje sigue su camino
 * descrito —«el cliente envió una nota de voz»—. El camino sin transcripción
 * es el de siempre, no un modo degradado improvisado.
 */
export async function transcribirNotaDeVoz(
  organizationId: string,
  messageId: string
): Promise<void> {
  if (!transcripcionDisponible()) return;

  try {
    const db = getDb();
    const filas = await db
      .select({
        type: schema.message.type,
        text: schema.message.text,
        mediaAssetId: schema.message.mediaAssetId,
        direction: schema.message.direction,
      })
      .from(schema.message)
      .where(
        scoped(
          schema.message.organizationId,
          organizationId,
          eq(schema.message.id, messageId)
        )
      )
      .limit(1);

    const msg = filas[0];
    if (!msg || msg.direction !== "in") return;
    if (msg.type !== "audio" && msg.type !== "voice") return;
    // Si ya tiene texto, alguien lo puso: no se pisa.
    if (msg.text && msg.text.trim()) return;
    if (!msg.mediaAssetId) return;

    // El audio puede seguir bajándose: la ingesta la dispara sin esperarla.
    const asset = await ensureAssetAvailable(organizationId, msg.mediaAssetId);
    if (!asset || asset.fetchStatus !== "available") return;

    const resultado = await transcribirAudio({
      organizationId,
      assetId: msg.mediaAssetId,
      mimeType: asset.mimeType,
    });
    if (!resultado.ok) return;

    await db
      .update(schema.message)
      .set({ text: resultado.texto })
      .where(
        scoped(
          schema.message.organizationId,
          organizationId,
          and(eq(schema.message.id, messageId), eq(schema.message.direction, "in"))
        )
      );
  } catch (err) {
    // Un fallo aquí jamás puede dejar sin respuesta a un cliente.
    console.warn(`[transcripción] ${messageId} siguió sin transcribir:`, err);
  }
}
