import { graphRequest } from "@/lib/meta/client";
import { getCredentialsByOrg } from "@/server/whatsapp/credentials";

/**
 * 135 — Pedirle a Meta el conjunto de datos de mensajería del negocio.
 *
 * El ID que Ajustes → Anuncios pide a mano **no se puede conseguir por la
 * interfaz de Meta**: el Administrador de eventos muestra píxeles web, y el de
 * WhatsApp puede no existir todavía. Se obtiene con `POST {waba_id}/dataset`,
 * que es idempotente: lo crea si falta y devuelve el mismo si ya está.
 *
 * El CRM tiene las dos piezas que hacen falta —el `waba_id` y el token— desde
 * que el negocio conectó WhatsApp. **No es Embedded Signup**: no abre ninguna
 * ventana, no conecta cuentas y no necesita ser Tech Provider.
 */

export type ResultadoDataset =
  | { ok: true; datasetId: string }
  | { ok: false; motivo: "sin_whatsapp" | "sin_permiso" | "meta_fallo"; detalle: string };

/** Lo que Meta devuelve. Solo interesa el id. */
type RespuestaDataset = { id?: string };

export async function obtenerDatasetDelNegocio(
  organizationId: string
): Promise<ResultadoDataset> {
  const cred = await getCredentialsByOrg(organizationId);
  if (!cred) {
    return {
      ok: false,
      motivo: "sin_whatsapp",
      detalle:
        "Primero conectá WhatsApp en Ajustes → WhatsApp. El conjunto de datos es el de esa misma cuenta.",
    };
  }

  try {
    const r = await graphRequest<RespuestaDataset>(`${cred.wabaId}/dataset`, {
      method: "POST",
      token: cred.token,
    });
    if (!r.id) {
      return {
        ok: false,
        motivo: "meta_fallo",
        detalle: "Meta respondió sin el identificador. Probá de nuevo en un momento.",
      };
    }
    return { ok: true, datasetId: r.id };
  } catch (err) {
    /*
     * El permiso es el riesgo conocido (ver la spec): 016 asume que el token
     * puede PUBLICAR en el dataset; crearlo puede pedir
     * `whatsapp_business_management`. Si falta, se dice con todas las letras y
     * el campo manual sigue sirviendo — no se pierde nada.
     */
    const texto = err instanceof Error ? err.message : String(err);
    const esPermiso = /permission|OAuth|#200|#10|unauthor/i.test(texto);
    // Ni al cliente NI AL REGISTRO (Constitución I). El mensaje de Meta puede
    // traer el token dentro: se descubrió porque una prueba de esta misma
    // tanda lo imprimió en la salida.
    console.error("[capi] no se pudo obtener el dataset:", sinSecretos(texto, cred.token));
    return {
      ok: false,
      motivo: esPermiso ? "sin_permiso" : "meta_fallo",
      detalle: esPermiso
        ? "El token de WhatsApp de este negocio no tiene permiso para crear el conjunto de datos. Pegá el ID a mano, o pedile a Meta el permiso whatsapp_business_management."
        : "Meta no respondió como se esperaba. Pegá el ID a mano o probá más tarde.",
    };
  }
}

/**
 * Tapa el token si el mensaje del proveedor lo trae. Deja los últimos 4, que
 * es lo que el resto del repo muestra de un secreto y alcanza para saber de
 * cuál se trata.
 */
function sinSecretos(texto: string, token: string): string {
  if (!token || token.length < 8) return texto;
  return texto.split(token).join(`…${token.slice(-4)}`);
}
