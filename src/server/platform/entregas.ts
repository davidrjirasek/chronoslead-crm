/**
 * 110 — Dónde se escribe lo que el operador tiene que entregarle a un cliente:
 * hoy, los enlaces de primer acceso de `provision` y `acceso`.
 *
 * En local es `.provision/` junto al repo. Dentro de la imagen no sirve: `/app`
 * es de root (la app corre como `vocero`) y además se rehace entero en cada
 * despliegue. Un enlace escrito ahí o falla al crearse o desaparece antes de
 * que nadie lo lea — y un alta que no se puede entregar no es un alta.
 *
 * Por eso el Dockerfile fija `PROVISION_DIR=/data/.provision`, dentro del
 * volumen, exactamente igual que hace con `MEDIA_DIR`. Misma idea y mismo
 * mecanismo: lo que tiene que sobrevivir al despliegue vive en `/data`.
 */

export const DIRECTORIO_POR_DEFECTO = ".provision";

/**
 * Un valor vacío cuenta como ausente: los paneles de despliegue inyectan
 * `VAR=""` para las opcionales que nadie rellenó, y eso debe caer en el
 * default, no escribir en la raíz del sistema de archivos.
 */
export function directorioDeEntregas(
  env: Record<string, string | undefined> = process.env
): string {
  const crudo = (env.PROVISION_DIR ?? "").trim();
  return crudo === "" ? DIRECTORIO_POR_DEFECTO : crudo;
}
