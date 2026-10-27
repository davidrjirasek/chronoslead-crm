/**
 * 121 — Qué parte de la API de autenticación NO se sirve.
 *
 * Puro y aparte para poder probarlo sin levantar nada: el guardián de la ruta
 * solo decide, y la decisión se prueba sola.
 */

/**
 * Si la URL pide una ruta del plugin de organización
 * (`/api/auth/organization/...`), que resuelve por la membresía activa de la
 * sesión y no por el Host.
 *
 * Se compara sobre el camino, nunca sobre la URL entera: `?x=/organization/`
 * en la consulta no tiene que cerrar nada, y `/api/auth/organizations` —otra
 * ruta, si alguna vez existe— tampoco.
 */
export function rutaDeOrganizacion(url: string): boolean {
  let camino: string;
  try {
    camino = new URL(url).pathname;
  } catch {
    // Sin URL parseable no se arriesga: se deja pasar al manejador, que ya
    // sabe rechazar lo que no entiende. Cerrar por las dudas rompería el
    // inicio de sesión ante cualquier rareza.
    return false;
  }
  const segmentos = camino.split("/").filter(Boolean);
  const i = segmentos.indexOf("auth");
  return i !== -1 && segmentos[i + 1] === "organization";
}
