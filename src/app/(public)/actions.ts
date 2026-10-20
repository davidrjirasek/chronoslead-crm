"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { normalizeMx } from "@/lib/meta/client";
import { getOrCreateContactByIdentity } from "@/server/inbox/identity";
import { createLeadForContact } from "@/server/inbox/lead-activity";
import { checkRateLimit } from "@/lib/rate-limit";
import { scoped } from "@/lib/db/tenant";
import { upsertFicha } from "@/server/bot/ficha";

export type ActionState = { error: string | null; ok: boolean };

/**
 * 107 — El formulario de la landing entra al CRM por la MISMA puerta que un
 * mensaje de WhatsApp: contacto + lead en la primera etapa del pipeline.
 *
 * Se reutilizan `getOrCreateContactByIdentity` y `createLeadForContact` en vez
 * de insertar a mano: el cálculo de la posición, la deduplicación por identidad
 * y la bitácora de etapas son lo bastante sutiles como para que una segunda
 * copia diverja en el primer cambio.
 *
 * La organización dueña de la landing es la de la propia plataforma, y se
 * nombra por slug en una variable: cablearla aquí obligaría a tocar código para
 * cambiar a qué pipeline caen los leads comerciales.
 */
const SLUG_POR_DEFECTO = "creativo-4d-group";

function slugDeLaLanding(): string {
  return (process.env.LANDING_ORG_SLUG ?? SLUG_POR_DEFECTO).trim().toLowerCase();
}

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(30),
  rubro: z.string().trim().min(1).max(120),
  empresa: z.string().trim().max(120).optional(),
  yaInvierteEnAnuncios: z.string().trim().max(40).optional(),
});

/** Es un formulario público: sin límite, es un buzón de spam abierto. */
const LIMITE = { windowMs: 10 * 60_000, max: 5 };

const ERROR_GENERICO =
  "No se pudo registrar tu consulta. Escribinos por WhatsApp y te atendemos.";

export async function capturarLeadAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    rubro: formData.get("rubro"),
    empresa: formData.get("empresa") || undefined,
    yaInvierteEnAnuncios: formData.get("yaInvierteEnAnuncios") || undefined,
  });
  if (!parsed.success) return { error: "Revisá los datos del formulario.", ok: false };

  const telefono = normalizeMx(parsed.data.phone.replace(/[^\d]/g, ""));
  if (!checkRateLimit(`landing-lead:${telefono}`, LIMITE).allowed) {
    return { error: "Ya recibimos tu consulta. Te contactamos enseguida.", ok: true };
  }

  const db = getDb();
  const orgs = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slugDeLaLanding()))
    .limit(1);
  const organizationId = orgs[0]?.id;
  if (!organizationId) {
    // No se le cuenta al visitante que falta configurar una organización: eso
    // es un problema del operador, no suyo.
    console.error(
      `[landing] no existe la organización "${slugDeLaLanding()}": el lead no se guardó. ` +
        "Créala con pnpm provision o apunta LANDING_ORG_SLUG a la correcta."
    );
    return { error: ERROR_GENERICO, ok: false };
  }

  try {
    const { contact } = await getOrCreateContactByIdentity(organizationId, {
      identity: telefono,
      channel: "whatsapp",
      phone: telefono,
      waUserId: null,
      profileName: parsed.data.name,
    });
    await createLeadForContact({
      organizationId,
      contactId: contact.id,
      source: "sistema",
    });
    await anotarLaConsulta(organizationId, contact.id, parsed.data);
  } catch (err) {
    console.error("[landing] error capturando el lead:", err);
    return { error: ERROR_GENERICO, ok: false };
  }

  return { error: null, ok: true };
}

/**
 * Lo que el visitante contó va a la ficha del contacto, no a un campo nuevo:
 * cada negocio califica distinto y la ficha existe justo para eso.
 *
 * Por `upsertFicha` y no con un UPDATE propio: esa puerta filtra por
 * organización ella misma, y un guardarraíl de upstream
 * (`tests/unit/ficha-guard.test.ts`) escanea `src/` para que nadie la esquive.
 * La primera versión de este archivo la esquivó y el test la cazó.
 */
async function anotarLaConsulta(
  organizationId: string,
  contactId: string,
  datos: z.infer<typeof leadSchema>
): Promise<void> {
  await upsertFicha({
    organizationId,
    contactId,
    ficha: {
      rubro: datos.rubro,
      ...(datos.empresa ? { empresa: datos.empresa } : {}),
      ...(datos.yaInvierteEnAnuncios
        ? { invierteEnAnuncios: datos.yaInvierteEnAnuncios }
        : {}),
      origen: "landing",
    },
  });
  await getDb()
    .update(schema.contact)
    .set({ source: "organico", updatedAt: new Date() })
    .where(
      scoped(schema.contact.organizationId, organizationId, eq(schema.contact.id, contactId))
    );
}
