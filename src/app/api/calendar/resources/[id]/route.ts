import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { agendaDisabledResponse, agendaEnabled } from "@/server/agenda/flag";
import {
  actualizarRecurso,
  desactivarRecurso,
  organizacionUsaRecursos,
  recursoPorId,
  RecursoError,
} from "@/server/agenda/recursos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function puerta(organizationId: string): Promise<Response | null> {
  if (!agendaEnabled()) return agendaDisabledResponse();
  if (!(await organizacionUsaRecursos(organizationId))) {
    return agendaDisabledResponse();
  }
  return null;
}

const avisoSchema = z.object({ phone: z.string(), name: z.string().nullish() });

const patchSchema = z.object({
  name: z.string().optional(),
  weeklyHours: z.record(z.string(), z.unknown()).nullish(),
  color: z.string().nullish(),
  criterio: z.string().nullish(),
  avisos: z.array(avisoSchema).optional(),
  active: z.boolean().optional(),
  position: z.number().optional(),
});

export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  const cerrada = await puerta(session.organizationId);
  if (cerrada) return cerrada;

  const { id } = await ctx.params;
  // `scoped()` ya impide tocar el de otra organización; esto convierte el
  // silencio en un 404 honesto.
  if (!(await recursoPorId(session.organizationId, id))) {
    return apiError(404, "not_found", "Ese recurso no existe");
  }

  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  try {
    await actualizarRecurso(session.organizationId, id, {
      ...body.data,
      weeklyHours:
        body.data.weeklyHours === undefined
          ? undefined
          : ((body.data.weeklyHours ?? null) as never),
      avisos: body.data.avisos?.map((a) => ({
        phone: a.phone,
        name: a.name ?? null,
      })),
    });
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof RecursoError) {
      return apiError(422, "invalid_body", err.message);
    }
    throw err;
  }
});

/**
 * Dar de baja DESACTIVA, no borra: las citas que ya existen tienen que
 * quedarse donde están. Ver `desactivarRecurso()`.
 */
export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const cerrada = await puerta(session.organizationId);
  if (cerrada) return cerrada;
  const { id } = await ctx.params;
  if (!(await recursoPorId(session.organizationId, id))) {
    return apiError(404, "not_found", "Ese recurso no existe");
  }
  await desactivarRecurso(session.organizationId, id);
  return Response.json({ ok: true });
});
