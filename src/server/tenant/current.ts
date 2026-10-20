import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, schema } from "@/lib/db";
import { resolveTenantFromHost, type TenantHost } from "@/lib/tenant/host";
import { baseDomain, isCloud } from "@/server/tenant/edition";

/**
 * 101 — La organización de ESTA petición.
 *
 * Con `EDITION=cloud` sale del Host y de ningún otro sitio. Prohibido caer a
 * «la primera organización», «la única» o «la del usuario» cuando el Host no
 * resuelve: eso reintroduce el cruce de datos que esta capa existe para cerrar,
 * y lo haría en silencio.
 */

export type TenantOrg = {
  id: string;
  slug: string | null;
  name: string;
  metadata: string | null;
};

/**
 * El Host de la petición. Fuera de una petición (tarea en segundo plano, build)
 * no hay Host: devuelve null en vez de adivinar.
 */
async function requestHost(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-host") ?? h.get("host");
  } catch {
    return null;
  }
}

/** Qué clase de puerta es el Host actual: tenant, landing, admin, alta o ninguna. */
export async function currentTenantHost(): Promise<TenantHost> {
  return resolveTenantFromHost(await requestHost(), baseDomain());
}

async function orgBySlug(slug: string): Promise<TenantOrg | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.organization.id,
      slug: schema.organization.slug,
      name: schema.organization.name,
      metadata: schema.organization.metadata,
    })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Edición de un solo negocio: la única organización de la instancia. Es el
 * comportamiento del Vocero original y solo se usa sin `EDITION=cloud`.
 */
async function laUnicaOrganizacion(): Promise<TenantOrg | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.organization.id,
      slug: schema.organization.slug,
      name: schema.organization.name,
      metadata: schema.organization.metadata,
    })
    .from(schema.organization)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * `null` en una superficie de organización significa «esta instancia no
 * existe», nunca «usa otra».
 */
export async function currentTenantOrg(): Promise<TenantOrg | null> {
  if (!isCloud()) return laUnicaOrganizacion();
  const host = await currentTenantHost();
  if (host.kind !== "tenant") return null;
  return orgBySlug(host.slug);
}
