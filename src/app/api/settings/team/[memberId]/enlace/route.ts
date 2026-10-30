/**
 * 136 — Enlace de acceso para un miembro, desde el panel del CLIENTE.
 *
 * Saca a la plataforma del camino crítico: sin correo transaccional (lo prohíbe
 * la constitución), antes toda recuperación esperaba a que nosotros abriéramos
 * el panel de superadmin. Ahora el jefe destraba a su gente a cualquier hora.
 *
 * La regla de rangos es lo que impide que sea una escalada: un administrador no
 * puede generar el enlace del propietario, consumirlo y quedarse con la cuenta.
 */
import { apiError, withAuth } from "@/lib/api";
import { enlaceParaMiembro } from "@/server/equipo/gobierno";
import { isCloud } from "@/server/tenant/edition";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

export const POST = withAuth(async (session, _req: Request, ctx: Params) => {
  if (!isCloud()) return new Response(null, { status: 404 });
  const { memberId } = await ctx.params;

  const r = await enlaceParaMiembro(session, memberId);
  if (!r.ok) return apiError(r.estado, r.codigo, r.mensaje);
  return Response.json({ ok: true, url: r.url, email: r.email });
});
