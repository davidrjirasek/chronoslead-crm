import { requireSession } from "@/lib/auth/session";
import { isCloud } from "@/server/tenant/edition";
import { TeamClient } from "@/components/settings/team-client";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  /**
   * 136 — El panel necesita saber DOS cosas para no dibujar lo que no
   * corresponde: si estamos en plataforma y con qué rango mira quien entró.
   *
   * No dibujarlo no es la protección —el pedido se puede repetir a mano— sino
   * la cortesía. La protección vive en las rutas.
   */
  const session = await requireSession();
  return <TeamClient cloud={isCloud()} rolActual={session.role} />;
}
