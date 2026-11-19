import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  consultaDeLaOrganizacion,
  guardarConsulta,
  preguntarAlSistema,
} from "@/server/consulta";

export const dynamic = "force-dynamic";

/**
 * 151 — La consulta que el agente le puede hacer al sistema del negocio.
 *
 * La credencial **nunca vuelve completa**: solo si existe y sus últimos 4.
 * Es la misma regla que el token de WhatsApp y la llave de IA.
 */
export const GET = withAuth(async (session) => {
  const consulta = await consultaDeLaOrganizacion(session.organizationId);
  return Response.json({ consulta });
});

const putSchema = z.object({
  name: z.string().optional(),
  criterio: z.string().nullish(),
  datoPedido: z.string().optional(),
  url: z.string().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  requestField: z.string().optional(),
  responseField: z.string().optional(),
  authHeader: z.string().nullish(),
  /** Ausente = no se toca. Cadena vacía = se borra. */
  authValue: z.string().nullish(),
  active: z.boolean().optional(),
});

export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  if (body.data.url && !/^https?:\/\//i.test(body.data.url.trim())) {
    return apiError(422, "invalid_body", "La dirección tiene que empezar con https://");
  }

  const consulta = await guardarConsulta(session.organizationId, {
    ...body.data,
    criterio: body.data.criterio === undefined ? undefined : body.data.criterio,
    authHeader:
      body.data.authHeader === undefined ? undefined : body.data.authHeader,
    // `""` desde el formulario significa «no lo toqué»: borrar la credencial
    // es explícito (null), no un efecto de dejar el campo vacío.
    authValue:
      body.data.authValue === undefined || body.data.authValue === ""
        ? undefined
        : body.data.authValue,
  });
  return Response.json({ consulta });
});

const postSchema = z.object({ dato: z.string().min(1) });

/**
 * «Probar conexión»: manda una consulta REAL y devuelve lo que contestó, sin
 * interpretar. Es el «curl primero» que pide el brief, hecho desde la
 * pantalla y sin que la credencial pase por el chat de nadie.
 */
export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;

  const r = await preguntarAlSistema(session.organizationId, body.data.dato);
  return Response.json({
    ok: r.ok,
    valor: r.ok ? r.valor : null,
    motivo: r.ok ? null : r.motivo,
    detalle: r.ok ? null : r.detalle,
    // Lo crudo es el punto de esta prueba: enseña la forma real de la
    // respuesta, que es lo que hay que implementar.
    crudo: r.ok ? r.crudo : r.crudo ?? null,
  });
});
