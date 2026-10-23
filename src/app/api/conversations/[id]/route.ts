import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { construirEventoOlvido } from "@/server/brains/contract";
import { avisarOlvido, type ResultadoOlvido } from "@/server/brains/deliver";
import { publish } from "@/server/events/bus";
import { eliminarConversacion } from "@/server/inbox/eliminar";
import { serializeConversation, getConversation, updateConversation } from "@/server/inbox/queries";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  aiEnabled: z.boolean().optional(),
  reactivate: z.boolean().optional(),
  markRead: z.boolean().optional(),
  /**
   * 119 — `true` la toma quien está en sesión; `false` la suelta.
   *
   * Es un booleano y NO un nombre a propósito: el nombre sale de la sesión.
   * Si viniera del cliente, cualquiera podría firmar la conversación con el
   * nombre de otro, y lo único que este registro tiene que garantizar es
   * justamente quién fue.
   */
  tomar: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const { tomar, ...resto } = body.data;
  let patchTomar: { userId: string; nombre: string } | null | undefined;
  if (tomar !== undefined) {
    patchTomar = tomar
      ? { userId: session.userId, nombre: await nombreDeUsuario(session.userId) }
      : null;
  }

  const updated = await updateConversation(session.organizationId, id, {
    ...resto,
    ...(patchTomar !== undefined ? { tomar: patchTomar } : {}),
  });
  if (!updated) return apiError(404, "not_found", "Conversación no encontrada");

  const row = await getConversation(session.organizationId, id);
  if (row) {
    const dto = serializeConversation(
      row.conversation,
      row.contact,
      null,
      null,
      row.anuncio
    );
    publish(session.organizationId, {
      type: "conversation.updated",
      data: { conversation: dto },
    });
    return Response.json({ conversation: dto });
  }
  return Response.json({ conversation: null });
});

/** El nombre con el que se firma la conversación. Nunca viene del cliente. */
async function nombreDeUsuario(userId: string): Promise<string> {
  const filas = await getDb()
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  // Un usuario sin nombre es raro, pero «alguien del equipo» dice más que
  // dejar el campo vacío: lo que importa es que alguien la tomó.
  return filas[0]?.name?.trim() || "alguien del equipo";
}

const FECHA_DE_CITA = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" });

/**
 * 026 — Elimina la conversación y le pide al cerebro que la olvide.
 *
 * `?contacto=1` se lleva además a la persona: contacto, lead y citas pasadas.
 * Es irreversible en los dos casos, y por eso exige rol de configuración
 * (propietario o administrador) y no solo operar la bandeja.
 */
export const DELETE = withAuth(async (session, req: Request, ctx: Params) => {
  if (!canConfigure(session.role)) {
    return apiError(
      403,
      "forbidden",
      "Solo quien administra el negocio puede eliminar conversaciones"
    );
  }
  const { id } = await ctx.params;
  const alcance =
    new URL(req.url).searchParams.get("contacto") === "1" ? "contacto" : "hilo";

  const resultado = await eliminarConversacion(session.organizationId, id, alcance);
  if (!resultado.ok) {
    if (resultado.motivo === "cita_pendiente") {
      return apiError(
        409,
        "cita_pendiente",
        `Tiene una cita agendada para el ${FECHA_DE_CITA.format(resultado.cuando)}. Cancélala en Citas antes de eliminar.`
      );
    }
    return apiError(404, "not_found", "Conversación no encontrada");
  }

  // Irreversible y sin papelera: que al menos quede quién y cuándo. Solo ids.
  console.info(
    `[bandeja] ${session.userId} eliminó ${id} (${alcance}) en ${session.organizationId}`
  );

  // El aviso va DESPUÉS del borrado y no lo condiciona: lo que se pidió ya
  // pasó, y un cerebro caído no puede dejar la conversación en la bandeja.
  let agente: ResultadoOlvido = "no_aplica";
  const deletedAt = new Date();
  for (const conversacion of resultado.conversaciones) {
    const aviso = await avisarOlvido(
      construirEventoOlvido({
        eventId: newId("olvido"),
        organization: resultado.organization,
        conversation: conversacion,
        contact: resultado.contact,
        deletedAt,
      })
    );
    if (aviso === "sin_confirmar" || agente === "no_aplica") agente = aviso;
  }

  for (const conversacion of resultado.conversaciones) {
    publish(session.organizationId, {
      type: "conversation.deleted",
      data: {
        conversationId: conversacion.id,
        contactId: resultado.contact.id,
        contactDeleted: alcance === "contacto",
      },
    });
  }
  return Response.json({ ok: true, alcance, agente });
});
