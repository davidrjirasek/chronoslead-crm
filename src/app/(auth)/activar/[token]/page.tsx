import { currentTenantOrg } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";
import { validarEnlace } from "@/server/platform/access-link";
import { ElegirContrasena } from "@/components/activar/elegir-contrasena";
import { EnlaceNoVale } from "@/components/activar/enlace-no-vale";

export const dynamic = "force-dynamic";

/**
 * 106 — Donde el cliente elige SU contraseña, la primera vez o tras perderla.
 *
 * Un enlace inventado, uno caducado y uno ya usado dan EXACTAMENTE la misma
 * pantalla: distinguirlos le diría a quien pruebe tokens al azar cuáles
 * existen.
 */
export default async function ActivarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isCloud()) return <EnlaceNoVale />;
  const org = await currentTenantOrg();
  if (!org) return <EnlaceNoVale />;

  const enlace = await validarEnlace(token, org.id);
  if (!enlace) return <EnlaceNoVale />;

  return (
    <ElegirContrasena
      token={token}
      motivo={enlace.motivo}
      nombreOrganizacion={enlace.nombreOrganizacion}
    />
  );
}
