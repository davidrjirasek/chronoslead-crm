import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { resolveMembership } from "@/server/auth/on-signup";
import { currentTenantOrg } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";

export type SessionContext = {
  userId: string;
  organizationId: string;
  role: string;
};

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Membresía de ESTE usuario en ESTA organización. Se consulta en cada petición
 * a propósito: el `organizationId` no se guarda en la cookie como fuente de
 * verdad, para que revocar un acceso surta efecto de inmediato y no al expirar
 * la sesión.
 */
async function membresiaEn(
  userId: string,
  organizationId: string
): Promise<{ organizationId: string; role: string } | null> {
  const db = getDb();
  const rows = await db
    .select({
      organizationId: schema.member.organizationId,
      role: schema.member.role,
    })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, organizationId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Sesión + organización activa para route handlers y server components.
 * Lanza UnauthorizedError si no hay sesión u organización.
 *
 * 101 — Con `EDITION=cloud` la organización sale del Host y la membresía se
 * comprueba contra ESA organización. Es el segundo candado: las cookies
 * host-only ya impiden que la sesión de un subdominio viaje a otro, pero el
 * servidor no puede confiar en el navegador para el aislamiento.
 *
 * Sin `EDITION=cloud` se conserva el comportamiento del Vocero original: la
 * organización del usuario, porque solo hay una.
 */
export async function requireSession(): Promise<SessionContext> {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new UnauthorizedError();

  if (isCloud()) {
    const tenant = await currentTenantOrg();
    // Prohibido caer a la organización del usuario: `loquesea.chronoslead.com`
    // abriría sesión sobre la organización que ese usuario tenga.
    if (!tenant) throw new UnauthorizedError("Host sin organización");
    const acceso = await membresiaEn(session.user.id, tenant.id);
    if (!acceso) throw new UnauthorizedError("Sin acceso a esta organización");
    return {
      userId: session.user.id,
      organizationId: acceso.organizationId,
      role: acceso.role,
    };
  }

  // La sesión puede crearse antes de que la membresía exista (registro
  // inicial) — la membresía en BD es la fuente de verdad de org + rol.
  const membership = await resolveMembership(session.user.id);
  if (!membership) {
    throw new UnauthorizedError("Sesión sin organización activa");
  }
  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}

/** Igual que requireSession pero devuelve null en vez de lanzar. */
export async function getSessionOrNull(): Promise<SessionContext | null> {
  try {
    return await requireSession();
  } catch {
    return null;
  }
}
