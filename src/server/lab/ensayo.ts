import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { runAgentTurn } from "@/server/ai/pipeline";

/**
 * 140 — El ensayo: hablar con el agente sin que salga nada.
 *
 * El Laboratorio prueba COMPORTAMIENTO: corre personas fijas con guiones
 * genéricos y las evalúa un juez. Para verificar CONTENIDO —un precio, un
 * horario, una política recién cargada— hacía falta escribirle por WhatsApp, y
 * desde que los números son de clientes reales eso dejó de ser gratis.
 *
 * Esto es el mismo bucle que `runner.ts` —insertar un entrante, llamar a
 * `runAgentTurn`, leer la transcripción— con las líneas escritas por una
 * persona, de a una.
 *
 * **Lo que impide que salga a WhatsApp no está aquí**: la conversación se crea
 * con `isTest`, y el envío real lanza `sandbox_violation` sobre cualquier
 * conversación marcada así. Este módulo se APOYA en ese guardián; no lo toca
 * ni lo rodea.
 */

/**
 * El contacto del ensayo: fijo, reservado y archivado.
 *
 * `5210000000000` es el hueco que dejan las personas del Laboratorio, que usan
 * del `…0001` al `…0005`. Archivado para que no ensucie Contactos, igual que
 * ellas.
 */
const ENSAYO_PHONE = "5210000000000";
const ENSAYO_NOMBRE = "[Ensayo] Vos";

export type LineaDeEnsayo = {
  id: string;
  de: "vos" | "agente";
  texto: string;
  en: string;
};

export type Ensayo = {
  conversationId: string;
  lineas: LineaDeEnsayo[];
  /** 140/D3 — Si el agente escaló, por qué. Null si no escaló. */
  escalado: { motivo: string | null; en: string } | null;
};

async function contactoDeEnsayo(organizationId: string): Promise<string> {
  const db = getDb();
  const inserted = await db
    .insert(schema.contact)
    .values({
      id: newId("contact"),
      organizationId,
      phone: ENSAYO_PHONE,
      waIdentity: ENSAYO_PHONE,
      name: ENSAYO_NOMBRE,
      archivedAt: new Date(),
    })
    // Mismo cuidado que el Laboratorio: desde 014 el índice único incluye
    // `channel`, y un ON CONFLICT que no lo nombra no corresponde a ningún
    // índice.
    .onConflictDoNothing({
      target: [
        schema.contact.organizationId,
        schema.contact.channel,
        schema.contact.waIdentity,
      ],
    })
    .returning();
  if (inserted[0]) return inserted[0].id;

  const rows = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        scoped(schema.contact.organizationId, organizationId),
        eq(schema.contact.waIdentity, ENSAYO_PHONE)
      )
    )
    .limit(1);
  return rows[0]!.id;
}

/** La conversación de ensayo de esta organización; se crea si no existe. */
async function conversacionDeEnsayo(organizationId: string): Promise<string> {
  const db = getDb();
  const contactId = await contactoDeEnsayo(organizationId);

  const existentes = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        scoped(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.contactId, contactId),
        eq(schema.conversation.isTest, true)
      )
    )
    .limit(1);
  if (existentes[0]) return existentes[0].id;

  const id = newId("conversation");
  await db.insert(schema.conversation).values({
    id,
    organizationId,
    contactId,
    isTest: true,
    aiEnabled: true,
  });
  return id;
}

/** Lo dicho hasta ahora, y si el agente escaló. */
export async function leerEnsayo(organizationId: string): Promise<Ensayo> {
  const db = getDb();
  const conversationId = await conversacionDeEnsayo(organizationId);

  const [mensajes, conv] = await Promise.all([
    db
      .select()
      .from(schema.message)
      .where(
        and(
          scoped(schema.message.organizationId, organizationId),
          eq(schema.message.conversationId, conversationId)
        )
      )
      .orderBy(asc(schema.message.createdAt)),
    db
      .select({
        handoffAt: schema.conversation.handoffAt,
        handoffReason: schema.conversation.handoffReason,
      })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, conversationId))
      .limit(1),
  ]);

  const fila = conv[0];
  return {
    conversationId,
    lineas: mensajes
      .filter((m) => m.text)
      .map((m) => ({
        id: m.id,
        de: m.direction === "in" ? ("vos" as const) : ("agente" as const),
        texto: m.text!,
        en: m.createdAt.toISOString(),
      })),
    escalado: fila?.handoffAt
      ? { motivo: fila.handoffReason, en: fila.handoffAt.toISOString() }
      : null,
  };
}

/**
 * Escribe una línea y deja que el agente conteste.
 *
 * El turno corre SINCRÓNICO y se devuelve la transcripción ya con la
 * respuesta: es un mensaje, no cinco guiones, y quien está probando quiere ver
 * el resultado sin refrescar.
 */
export async function escribirEnEnsayo(
  organizationId: string,
  texto: string
): Promise<Ensayo> {
  const db = getDb();
  const conversationId = await conversacionDeEnsayo(organizationId);
  const ahora = new Date();

  await db.insert(schema.message).values({
    id: newId("message"),
    organizationId,
    conversationId,
    direction: "in",
    type: "text",
    text: texto,
    status: "delivered",
    waTimestamp: ahora,
  });
  await db
    .update(schema.conversation)
    .set({ lastInboundAt: ahora, lastMessageAt: ahora, updatedAt: ahora })
    .where(eq(schema.conversation.id, conversationId));

  await runAgentTurn(conversationId);
  return leerEnsayo(organizationId);
}

/**
 * Vaciar el ensayo y empezar de nuevo.
 *
 * Borra los mensajes y levanta el escalado: si el agente derivó en la prueba
 * anterior, sin esto se queda callado para siempre y parece roto.
 */
export async function reiniciarEnsayo(organizationId: string): Promise<Ensayo> {
  const db = getDb();
  const conversationId = await conversacionDeEnsayo(organizationId);

  await db
    .delete(schema.message)
    .where(
      and(
        scoped(schema.message.organizationId, organizationId),
        eq(schema.message.conversationId, conversationId)
      )
    );
  await db
    .update(schema.conversation)
    .set({
      handoffAt: null,
      handoffReason: null,
      aiEnabled: true,
      lastInboundAt: null,
      lastMessageAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.conversation.id, conversationId));

  return leerEnsayo(organizationId);
}
