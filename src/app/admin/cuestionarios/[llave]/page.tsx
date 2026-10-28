import { notFound, redirect } from "next/navigation";
import { accesoAlPanel } from "@/server/platform/superadmin";
import { leerPorLlave } from "@/server/cuestionario/store";
import { DetalleDelCuestionario } from "@/components/admin/cuestionario-detalle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cuestionario — ChronosLead" };

/** 128 — Las respuestas de un cliente, legibles y descargables. */
export default async function CuestionarioPage({
  params,
}: {
  params: Promise<{ llave: string }>;
}) {
  const acceso = await accesoAlPanel();
  if (!acceso.ok && acceso.motivo === "no_existe") notFound();
  if (!acceso.ok && acceso.motivo === "sin_sesion") redirect("/login");
  if (!acceso.ok) notFound();

  const { llave } = await params;
  const cuestionario = await leerPorLlave(decodeURIComponent(llave));
  if (!cuestionario) notFound();

  return <DetalleDelCuestionario cuestionario={cuestionario} />;
}
