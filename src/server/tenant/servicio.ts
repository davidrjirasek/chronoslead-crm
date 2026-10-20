import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { estadoDeOrganizacion, puedeEntrar } from "@/lib/tenant/estado";
import { isCloud } from "@/server/tenant/edition";

/**
 * 104 — Si esta organización tiene servicio ahora mismo.
 *
 * Existe aparte de `currentTenantOrg()` porque el trabajo en segundo plano —el
 * turno del agente, el despacho al cerebro, el Laboratorio— corre dentro de
 * `after()`, sin Host y sin sesión: ahí la organización llega como parámetro y
 * su estado hay que consultarlo.
 *
 * Suspendida corta el SERVICIO, no los datos: el webhook sigue guardando cada
 * mensaje que llegue. Lo que no pasa es que el agente conteste en nombre de un
 * negocio que ya no está pagando.
 */
export async function organizacionConServicio(
  organizationId: string
): Promise<boolean> {
  if (!isCloud()) return true;

  const rows = await getDb()
    .select({
      paidThrough: schema.organization.paidThrough,
      suspendedAt: schema.organization.suspendedAt,
      suspendedReason: schema.organization.suspendedReason,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  const fila = rows[0];
  // Una organización que ya no existe no tiene servicio. Nunca lo contrario:
  // ante la duda, no se contesta en nombre de nadie.
  if (!fila) return false;

  return puedeEntrar(estadoDeOrganizacion(fila, new Date()));
}
