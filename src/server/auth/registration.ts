import { count } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isCloud } from "@/server/tenant/edition";

/**
 * Registro público cerrado tras la primera organización (FR-060), salvo la
 * variable de escape ALLOW_SIGNUP=true. Las cuentas de equipo las crea el
 * propietario (bypass interno del gate).
 *
 * 101 — En plataforma el registro público NO existe, y `ALLOW_SIGNUP` deja de
 * poder reabrirlo: las organizaciones las crea solo el operador. Contar
 * organizaciones acertaría por accidente (con N ≥ 1 siempre cierra), pero la
 * regla correcta es «cerrado», no «cerrado porque ya hay alguien».
 */
export async function isPublicSignupAllowed(): Promise<boolean> {
  if (isCloud()) return false;
  if (process.env.ALLOW_SIGNUP === "true") return true;
  const db = getDb();
  const rows = await db.select({ n: count() }).from(schema.organization);
  return (rows[0]?.n ?? 0) === 0;
}
