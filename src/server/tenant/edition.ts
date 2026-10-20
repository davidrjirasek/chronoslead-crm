/**
 * 101 — Qué edición es esta instancia.
 *
 * Sin `EDITION=cloud` el repo se comporta exactamente como el Vocero original:
 * una instancia, un negocio, y la organización del usuario. Con ella, una
 * instancia sirve a muchas organizaciones y la actual sale del Host.
 *
 * Es una bandera y no un borrado de código porque `upstream`
 * (`kevinrivm/vocero-crm`) se sigue trayendo: cada línea que se borre de su
 * camino es un conflicto en el próximo merge. El mismo razonamiento de
 * `src/server/agenda/flag.ts` y ADR-001.
 */

const CLOUD_VALUES = new Set(["cloud", "saas", "plataforma"]);

export function parseEdition(raw: string | undefined): "cloud" | "single" {
  return CLOUD_VALUES.has((raw ?? "").trim().toLowerCase()) ? "cloud" : "single";
}

/**
 * Se lee de `process.env` directo, no por `getEnv()`, igual que
 * `agendaEnabled()`: preguntar en qué edición corre la instancia no puede
 * depender de que TODO el entorno valide, o una variable mal puesta en
 * cualquier otra parte haría que el aislamiento dejara de aplicarse.
 */
export function isCloud(): boolean {
  return parseEdition(process.env.EDITION) === "cloud";
}

/**
 * Dominio base del que cuelgan los subdominios. Vacío significa «no hay base»:
 * `resolveTenantFromHost` devuelve `desconocido` para todo, que es la
 * degradación correcta — ninguna petición cae en un tenant por accidente.
 */
export function baseDomain(): string {
  return (process.env.BASE_DOMAIN ?? "").trim().toLowerCase();
}
