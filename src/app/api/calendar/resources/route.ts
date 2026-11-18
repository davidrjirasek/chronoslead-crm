import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { agendaDisabledResponse, agendaEnabled } from "@/server/agenda/flag";
import {
  crearRecurso,
  organizacionUsaRecursos,
  recursosDeLaOrganizacion,
  RecursoError,
} from "@/server/agenda/recursos";

export const dynamic = "force-dynamic";

/**
 * 146 — Los recursos de la agenda (quién atiende).
 *
 * DOS puertas, no una: la bandera `AGENDA` de la instancia y el interruptor de
 * ESTA organización. Las dos responden 404, que es lo honesto — para un
 * cliente que no usa recursos, este endpoint no existe.
 */
async function puerta(organizationId: string): Promise<Response | null> {
  if (!agendaEnabled()) return agendaDisabledResponse();
  if (!(await organizacionUsaRecursos(organizationId))) {
    return agendaDisabledResponse();
  }
  return null;
}

export const GET = withAuth(async (session) => {
  const cerrada = await puerta(session.organizationId);
  if (cerrada) return cerrada;
  const recursos = await recursosDeLaOrganizacion(session.organizationId);
  return Response.json({ recursos });
});

const avisoSchema = z.object({
  phone: z.string(),
  name: z.string().nullish(),
});

const postSchema = z.object({
  name: z.string(),
  weeklyHours: z.record(z.string(), z.unknown()).nullish(),
  color: z.string().nullish(),
  criterio: z.string().nullish(),
  avisos: z.array(avisoSchema).optional(),
  position: z.number().optional(),
});

export const POST = withAuth(async (session, req: Request) => {
  const cerrada = await puerta(session.organizationId);
  if (cerrada) return cerrada;

  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;

  try {
    const id = await crearRecurso(session.organizationId, {
      name: body.data.name,
      weeklyHours: (body.data.weeklyHours ?? null) as never,
      color: body.data.color ?? null,
      criterio: body.data.criterio ?? null,
      avisos: (body.data.avisos ?? []).map((a) => ({
        phone: a.phone,
        name: a.name ?? null,
      })),
      position: body.data.position,
    });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof RecursoError) {
      return apiError(422, "invalid_body", err.message);
    }
    throw err;
  }
});
