import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { currentTenantHost } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";
import { esCorreoDeSuperadmin } from "@/lib/tenant/superadmin";

/** La comparación pura vive en `lib/tenant/superadmin` y se prueba sola. */
export { correosDeSuperadmin, esCorreoDeSuperadmin } from "@/lib/tenant/superadmin";

export type SesionSuperadmin = { userId: string; correo: string };

export type AccesoSuperadmin =
  | { ok: true; sesion: SesionSuperadmin }
  /** El panel no existe aquí: edición de un solo negocio, u otro Host. */
  | { ok: false; motivo: "no_existe" }
  /** Hay panel pero no hay sesión: toca entrar. */
  | { ok: false; motivo: "sin_sesion" }
  /** Hay sesión y no es de un superadmin. */
  | { ok: false; motivo: "prohibido"; correo: string };

/**
 * El acceso al panel. No pasa por `requireSession()` a propósito: esa exige
 * una organización, y el superadmin **no es miembro de ninguna** — administra
 * la cartera, no es dueño de nada.
 *
 * Ser superadmin tampoco abre el CRM de nadie: eso sigue pidiendo membresía.
 */
export async function accesoAlPanel(): Promise<AccesoSuperadmin> {
  if (!isCloud()) return { ok: false, motivo: "no_existe" };

  const host = await currentTenantHost();
  if (host.kind !== "admin") return { ok: false, motivo: "no_existe" };

  const sesion = await getAuth().api.getSession({ headers: await headers() });
  if (!sesion) return { ok: false, motivo: "sin_sesion" };

  const correo = sesion.user.email;
  if (!esCorreoDeSuperadmin(correo)) {
    return { ok: false, motivo: "prohibido", correo };
  }
  return { ok: true, sesion: { userId: sesion.user.id, correo } };
}
