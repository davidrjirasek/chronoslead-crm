/**
 * 136 — Cambiar el rol de un miembro y quitarlo del equipo.
 *
 * Ruta del fork: sin `EDITION=cloud` no existe, y el panel de upstream sigue
 * siendo el de siempre. La regla de rangos se aplica en `gobierno.ts`, no acá:
 * esconder el botón no protege nada, porque el pedido se puede repetir a mano
 * cambiándole el identificador.
 */
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { cambiarRol, quitarDelEquipo } from "@/server/equipo/gobierno";
import { ROLES_ASIGNABLES } from "@/lib/auth/rangos";
import { isCloud } from "@/server/tenant/edition";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

const rolSchema = z.object({ rol: z.enum(ROLES_ASIGNABLES) });

export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  if (!isCloud()) return new Response(null, { status: 404 });
  const { memberId } = await ctx.params;
  const body = await parseBody(req, rolSchema);
  if (!body.ok) return body.response;

  const r = await cambiarRol(session, memberId, body.data.rol);
  if (!r.ok) return apiError(r.estado, r.codigo, r.mensaje);
  return Response.json({ ok: true, email: r.email });
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Params) => {
  if (!isCloud()) return new Response(null, { status: 404 });
  const { memberId } = await ctx.params;

  const r = await quitarDelEquipo(session, memberId);
  if (!r.ok) return apiError(r.estado, r.codigo, r.mensaje);
  return Response.json({ ok: true, email: r.email });
});
