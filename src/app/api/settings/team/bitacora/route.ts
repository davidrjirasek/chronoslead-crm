/** 136 — La bitácora del equipo, visible para el cliente. */
import { apiError, withAuth } from "@/lib/api";
import { leerBitacora } from "@/server/equipo/gobierno";
import { puedeGobernarEquipo } from "@/lib/auth/rangos";
import { isCloud } from "@/server/tenant/edition";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  if (!isCloud()) return new Response(null, { status: 404 });
  if (!puedeGobernarEquipo(session.role)) {
    return apiError(403, "forbidden", "Hace falta ser propietario o administrador");
  }
  const filas = await leerBitacora(session.organizationId);
  return Response.json({
    movimientos: filas.map((f) => ({
      id: f.id,
      actor: f.actorEtiqueta,
      accion: f.accion,
      objetivo: f.objetivoEtiqueta,
      detalle: f.detalle,
      cuando: f.createdAt.toISOString(),
    })),
  });
});
