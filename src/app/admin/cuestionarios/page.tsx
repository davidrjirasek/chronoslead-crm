import { notFound, redirect } from "next/navigation";
import { accesoAlPanel } from "@/server/platform/superadmin";
import { listar } from "@/server/cuestionario/store";
import { ListaDeCuestionarios } from "@/components/admin/cuestionarios";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cuestionarios — ChronosLead" };

/**
 * 128 — La salida del formulario de onboarding.
 *
 * 127 lo dejó a medias: el formulario guardaba en producción y no había cómo
 * mirarlo. El guion de la terminal lee la base de la máquina de quien lo
 * corre, y a la de producción no se llega —puerto cerrado, firewall de tres
 * puertos, y el MCP de Coolify no ejecuta consultas—. Un formulario sin
 * salida es un formulario que no sirve.
 */
export default async function CuestionariosPage() {
  const acceso = await accesoAlPanel();
  if (!acceso.ok && acceso.motivo === "no_existe") notFound();
  if (!acceso.ok && acceso.motivo === "sin_sesion") redirect("/login");
  if (!acceso.ok) notFound();

  return <ListaDeCuestionarios filas={await listar()} />;
}
