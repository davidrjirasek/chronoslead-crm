import { notFound, redirect } from "next/navigation";
import { listarPadron, miembrosDeCartera } from "@/server/platform/padron";
import { saludDeLasDirecciones } from "@/server/platform/salud";
import { accesoAlPanel } from "@/server/platform/superadmin";
import { Padron } from "@/components/admin/padron";
import { SinPermiso } from "@/components/admin/sin-permiso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes — ChronosLead" };

/**
 * 108 — El panel del operador, en `admin.chronoslead.com`.
 *
 * Vive en un subdominio propio y no en una ruta del CRM: así no comparte
 * superficie con ningún cliente y no hay forma de llegar desde el CRM de nadie.
 */
export default async function AdminPage() {
  const acceso = await accesoAlPanel();

  // En una instancia de un solo negocio no hay cartera que administrar, y en
  // cualquier otro Host este panel sencillamente no existe.
  if (!acceso.ok && acceso.motivo === "no_existe") notFound();
  if (!acceso.ok && acceso.motivo === "sin_sesion") redirect("/login");
  if (!acceso.ok) return <SinPermiso correo={acceso.correo} />;

  const clientes = await listarPadron();
  // 136 — Para elegir A QUIÉN se le genera el enlace de acceso, por nombre.
  const miembros = await miembrosDeCartera();

  /*
   * 123 — La salud se consulta DESPUÉS del padrón y en paralelo entre sí: son
   * peticiones de red, no base de datos. Nunca lanza, así que el panel abre
   * aunque todas fallen — con las direcciones en gris, que es información
   * honesta y no una pantalla de error.
   */
  const salud = await saludDeLasDirecciones(clientes.map((c) => c.slug));

  return (
    <Padron
      clientes={clientes}
      operador={acceso.sesion.correo}
      salud={Object.fromEntries(salud)}
      miembros={miembros}
    />
  );
}
