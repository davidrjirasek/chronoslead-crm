/**
 * 136 — A qué organizaciones pertenece quien está en sesión.
 *
 * Reemplaza al consentimiento: a nadie se le pide permiso para sumarlo a un
 * equipo —un empleador no se lo pide a su empleado—, pero nada queda oculto.
 */
import { withAuth } from "@/lib/api";
import { misOrganizaciones } from "@/server/equipo/gobierno";
import { isCloud } from "@/server/tenant/edition";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  if (!isCloud()) return new Response(null, { status: 404 });
  const filas = await misOrganizaciones(session.userId);
  return Response.json({
    organizaciones: filas.map((f) => ({
      slug: f.slug,
      nombre: f.nombre,
      rol: f.rol,
      desde: f.desde.toISOString(),
    })),
  });
});
