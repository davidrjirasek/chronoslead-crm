import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { accesoAlPanel } from "@/server/platform/superadmin";
import { historicoDePagos } from "@/server/platform/padron";
import { Extracto } from "@/components/admin/extracto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Extracto de cobros — ChronosLead" };

/**
 * 109 — El extracto imprimible de un cliente.
 *
 * Se convierte en PDF con la impresión del navegador (Cmd+P → Guardar como
 * PDF). Sin librería de PDF en el servidor: habría sido una dependencia nueva
 * —de las que la constitución mira con lupa— para producir exactamente lo que
 * el navegador ya sabe hacer, y encima peor maquetado.
 */
export default async function ExtractoPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const acceso = await accesoAlPanel();
  if (!acceso.ok && acceso.motivo === "no_existe") notFound();
  if (!acceso.ok && acceso.motivo === "sin_sesion") redirect("/login");
  // Un extracto es información de facturación: lo ve quien administra, nadie más.
  if (!acceso.ok) notFound();

  const { organizationId } = await params;
  const filas = await getDb()
    .select({
      nombre: schema.organization.name,
      slug: schema.organization.slug,
      altaEn: schema.organization.createdAt,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  const cliente = filas[0];
  if (!cliente) notFound();

  const pagos = await historicoDePagos(organizationId);
  return (
    <Extracto
      nombre={cliente.nombre}
      slug={cliente.slug}
      altaEn={cliente.altaEn}
      pagos={pagos}
      emitidoPor={acceso.sesion.correo}
    />
  );
}
