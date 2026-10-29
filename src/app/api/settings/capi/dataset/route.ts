import { apiError, withAuth } from "@/lib/api";
import {
  atribucionDisabledResponse,
  atribucionEnabled,
} from "@/server/attribution/flag";
import { obtenerDatasetDelNegocio } from "@/server/attribution/dataset";

export const dynamic = "force-dynamic";

/**
 * 135 — «Obtener el mío»: el CRM le pide a Meta el conjunto de datos de este
 * negocio, con el token que ese mismo negocio ya conectó.
 *
 * POST y no GET aunque parezca una consulta: del lado de Meta **crea** el
 * conjunto si no existe. Es idempotente, pero no es de solo lectura.
 *
 * Devuelve el id y nada más. El token nunca sale del servidor.
 */
export const POST = withAuth(async (session) => {
  if (!atribucionEnabled()) return atribucionDisabledResponse();

  const r = await obtenerDatasetDelNegocio(session.organizationId);
  if (!r.ok) {
    // 409 y no 500: no se rompió nada, falta una condición del negocio
    // —WhatsApp sin conectar, o un token sin ese permiso—.
    return apiError(409, r.motivo, r.detalle);
  }
  return Response.json({ datasetId: r.datasetId });
});
