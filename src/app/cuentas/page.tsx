import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { currentTenantHost } from "@/server/tenant/current";
import { isCloud, baseDomain } from "@/server/tenant/edition";
import { misOrganizaciones } from "@/server/equipo/gobierno";
import { ListaDeCuentas } from "@/components/cuentas/lista";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tus cuentas — ChronosLead" };

/**
 * 138 — El lanzador: a qué cuentas pertenece quien entró.
 *
 * Nadie puede recordar la dirección de cada cliente. Con nueve ya molesta; con
 * cincuenta es imposible. Y el equipo de soporte entra a todas.
 *
 * Por qué pide sesión, si eso obliga a una contraseña más por semana: una
 * página pública con la lista de clientes le regalaría la cartera a cualquiera
 * que escriba la dirección. Pedir sesión es lo que la vuelve privada — y la
 * lista sale de las MEMBRESÍAS de quien entró, así que cada uno ve lo suyo y
 * nada más.
 *
 * No usa `requireSession()` a propósito: esa exige que el Host sea de un
 * cliente, y este no lo es. Lee la sesión directo y consulta por usuario, como
 * hace el panel de plataforma.
 */
export default async function CuentasPage() {
  if (!isCloud()) notFound();
  const host = await currentTenantHost();
  if (host.kind !== "cuentas") notFound();

  const sesion = await getAuth().api.getSession({ headers: await headers() });
  if (!sesion) redirect("/login");

  const organizaciones = await misOrganizaciones(sesion.user.id);

  return (
    <ListaDeCuentas
      correo={sesion.user.email}
      base={baseDomain()}
      appBaseUrl={process.env.APP_BASE_URL ?? ""}
      organizaciones={organizaciones.map((o) => ({
        slug: o.slug,
        nombre: o.nombre,
        rol: o.rol,
      }))}
    />
  );
}
