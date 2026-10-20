import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 102 — El segmento firmado de la URL del webhook de una organización.
 *
 * `/api/webhooks/wa/{organizationId}/{firma}`
 *
 * Se DERIVA en vez de guardarse: un secreto guardado habría que cifrarlo para
 * poder mostrarlo e indexar un hash aparte para poder buscarlo. Derivado, no
 * hay nada que guardar ni que se pueda filtrar desde la base.
 *
 * La etiqueta de dominio impide que este HMAC valga en ningún otro contexto,
 * aunque salga de la misma clave maestra de la instancia.
 */
const DOMINIO = "chronoslead:webhook:v1";

/**
 * `webhook_token_version` permite rotar la URL de UNA organización sin tocar
 * las demás: se sube el entero y la URL anterior deja de validar.
 */
export function segmentoDeOrganizacion(
  organizationId: string,
  version: number,
  claveMaestra: string
): string {
  return createHmac("sha256", claveMaestra)
    .update(`${DOMINIO}:${organizationId}:${version}`)
    .digest("base64url");
}

/** Comparación en tiempo constante: la longitud distinta no es una pista. */
function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function segmentoValido(
  organizationId: string,
  version: number,
  claveMaestra: string,
  candidato: string | undefined | null
): boolean {
  if (!candidato) return false;
  return igualSeguro(
    candidato,
    segmentoDeOrganizacion(organizationId, version, claveMaestra)
  );
}
