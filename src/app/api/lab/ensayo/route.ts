import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { isAiConfiguredFor } from "@/lib/ai/provider";
import {
  escribirEnEnsayo,
  leerEnsayo,
  reiniciarEnsayo,
} from "@/server/lab/ensayo";

/**
 * 140 — El ensayo del Laboratorio.
 *
 * GET lee, POST escribe una línea y espera la respuesta del agente, DELETE lo
 * vacía. Todo acotado a la organización de la sesión: el ensayo de una no se
 * ve ni se toca desde otra.
 */
export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) =>
  Response.json(await leerEnsayo(session.organizationId))
);

const postSchema = z.object({
  texto: z.string().trim().min(1).max(4000),
});

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;

  /**
   * 140/D5 — Sin IA, `runAgentTurn` vuelve sin hacer nada y el operador
   * escribe contra una pared: parece roto. Se dice antes, con el motivo.
   */
  if (!(await isAiConfiguredFor(session.organizationId))) {
    return apiError(
      409,
      "sin_ia",
      "Esta cuenta todavía no tiene llave de IA: el agente no puede contestar. Cárgala en Ajustes → IA."
    );
  }

  return Response.json(await escribirEnEnsayo(session.organizationId, body.data.texto));
});

export const DELETE = withAuth(async (session) =>
  Response.json(await reiniciarEnsayo(session.organizationId))
);
