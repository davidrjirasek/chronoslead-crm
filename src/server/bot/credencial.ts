import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 103 — La credencial de `/api/bot/*` en plataforma.
 *
 * En edición de un solo negocio, `BOT_API_KEY` ES la credencial: un cerebro,
 * un negocio. En plataforma eso sería una llave maestra — quien tenga la de un
 * cliente las tiene todas — así que `BOT_API_KEY` pasa a ser el **secreto del
 * despliegue**, que nadie ve, y de él se deriva una credencial por organización:
 *
 *     {organizationId}.{HMAC-SHA256(BOT_API_KEY, "chronoslead:cerebro:v1:{orgId}")}
 *
 * Ventajas de derivar en vez de guardar: no hay credencial que almacenar,
 * cifrar ni caducar; rotar el secreto del despliegue revoca todas a la vez; y
 * la organización se resuelve en O(1) porque viaja delante, sin probar una por
 * una ni indexar hashes.
 *
 * La etiqueta de dominio impide que este HMAC valga en otro contexto derivado
 * de la misma clave (el del webhook usa la suya).
 */
const DOMINIO = "chronoslead:cerebro:v1";

export function credencialDeOrganizacion(
  organizationId: string,
  secretoDelDespliegue: string
): string {
  const firma = createHmac("sha256", secretoDelDespliegue)
    .update(`${DOMINIO}:${organizationId}`)
    .digest("base64url");
  return `${organizationId}.${firma}`;
}

function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * De qué organización es esta credencial, o `null` si no es de ninguna.
 *
 * Puro: no toca la base. Que la organización siga existiendo lo comprueba
 * quien la use (`resolveInstanceOrg`), porque eso sí es estado.
 */
export function organizacionDeCredencial(
  credencial: string | null | undefined,
  secretoDelDespliegue: string
): string | null {
  if (!credencial || !secretoDelDespliegue) return null;
  // El id lleva prefijo `org_` y nunca un punto; la firma es base64url, que
  // tampoco lo lleva. Un solo separador, el primero.
  const corte = credencial.indexOf(".");
  if (corte <= 0 || corte === credencial.length - 1) return null;
  const organizationId = credencial.slice(0, corte);
  const esperada = credencialDeOrganizacion(
    organizationId,
    secretoDelDespliegue
  );
  return igualSeguro(credencial, esperada) ? organizationId : null;
}
