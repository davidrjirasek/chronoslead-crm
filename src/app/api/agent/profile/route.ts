import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { estadoIaDe, mensajeDeEstado } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.agentProfile)
    .where(scoped(schema.agentProfile.organizationId, session.organizationId))
    .limit(1);
  const p = rows[0];
  if (!p) return apiError(404, "not_found", "Perfil del agente no encontrado");
  const estado = await estadoIaDe(session.organizationId);
  // 117 — A quién avisar cuando escala. Vive en la organización y no en el
  // perfil: si mañana cambian de agente, el número de avisos sigue siendo el
  // mismo. Por eso se lee aparte en vez de salir del `select` de arriba.
  const orgs = await db
    .select({
      alertPhone: schema.organization.alertPhone,
      alertName: schema.organization.alertName,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, session.organizationId))
    .limit(1);
  return Response.json({
    avisos: {
      phone: orgs[0]?.alertPhone ?? null,
      name: orgs[0]?.alertName ?? null,
    },
    profile: {
      enabled: p.enabled,
      name: p.name,
      tone: p.tone,
      instructions: p.instructions,
      escalationRules: p.escalationRules,
      greeting: p.greeting,
    },
    aiConfigured: estado.activa,
    // Por qué no (sin configurar, llave rechazada, sin saldo): la pantalla
    // Agente lo dice con el enlace a Ajustes → IA.
    aiMensaje: mensajeDeEstado(estado),
  });
});

const putSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  tone: z.string().max(500).nullable().optional(),
  instructions: z.string().max(8000).nullable().optional(),
  escalationRules: z.string().max(4000).nullable().optional(),
  greeting: z.string().max(1000).nullable().optional(),
  /**
   * 117 — Vacío APAGA los avisos; no es un error. Se exige código de país por
   * el mismo motivo que el alta de contactos: diez dígitos son un número
   * local en varios países y el aviso no llegaría nunca.
   */
  alertPhone: z
    .string()
    .trim()
    .max(25)
    .nullable()
    .optional()
    .refine(
      (v) => !v || v.replace(/\D/g, "").length >= 11,
      "Poné el número con código de país, por ejemplo +595 981 123456"
    ),
  alertName: z.string().trim().max(80).nullable().optional(),
});

export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const { alertPhone, alertName, ...perfil } = body.data;

  if (alertPhone !== undefined || alertName !== undefined) {
    await db
      .update(schema.organization)
      .set({
        ...(alertPhone !== undefined
          ? { alertPhone: alertPhone?.trim() || null }
          : {}),
        ...(alertName !== undefined
          ? { alertName: alertName?.trim() || null }
          : {}),
      })
      .where(eq(schema.organization.id, session.organizationId));
  }
  if (Object.keys(perfil).length === 0) return Response.json({ ok: true });

  const updated = await db
    .update(schema.agentProfile)
    .set({ ...perfil, updatedAt: new Date() })
    .where(scoped(schema.agentProfile.organizationId, session.organizationId))
    .returning();
  if (!updated[0]) return apiError(404, "not_found", "Perfil no encontrado");
  return Response.json({ ok: true });
});
