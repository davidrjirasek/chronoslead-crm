import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  normalizeBranding,
  type Branding,
} from "@/lib/branding";
import { currentTenantOrg } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";

/** Marca guardada en organization.metadata (JSON de Better Auth). */

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Marca + a qué organización pertenece.
 *
 * El icono se guarda como archivo en `MEDIA_DIR/{organizationId}/favicon`, así
 * que servirlo necesita el id — y la ruta que lo sirve es pública (el login
 * también tiene pestaña), donde no hay sesión de la que sacarlo.
 */
export async function getBrandingContext(
  organizationId?: string | null
): Promise<{ organizationId: string | null; branding: Branding }> {
  const db = getDb();
  let fila: { id: string; metadata: string | null } | undefined;

  if (organizationId) {
    const rows = await db
      .select({ id: schema.organization.id, metadata: schema.organization.metadata })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1);
    fila = rows[0];
  } else if (isCloud()) {
    // 101 — Sin sesión y en plataforma, la marca sale del Host. Si el Host no
    // es de nadie, la marca por defecto: jamás el logo de otra organización,
    // que es lo que se vería con un `limit(1)` sin `where`.
    const tenant = await currentTenantOrg();
    fila = tenant ? { id: tenant.id, metadata: tenant.metadata } : undefined;
  } else {
    // Edición de un solo negocio: la única organización de la instancia.
    const rows = await db
      .select({ id: schema.organization.id, metadata: schema.organization.metadata })
      .from(schema.organization)
      .limit(1);
    fila = rows[0];
  }

  if (!fila) return { organizationId: null, branding: DEFAULT_BRANDING };
  const meta = parseMetadata(fila.metadata);
  return {
    organizationId: fila.id,
    branding: normalizeBranding(
      (meta.branding as Partial<Branding> | undefined) ?? null
    ),
  };
}

export async function getBranding(
  organizationId?: string | null
): Promise<Branding> {
  return (await getBrandingContext(organizationId)).branding;
}

export async function saveBranding(
  organizationId: string,
  branding: Branding
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  meta.branding = normalizeBranding(branding);
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(schema.organization.id, organizationId));
}
