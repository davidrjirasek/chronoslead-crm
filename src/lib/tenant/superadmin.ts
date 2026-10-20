/**
 * 108 — Quién administra la cartera de clientes.
 *
 * Puro a propósito, separado de la puerta que lee la petición: todo el acceso
 * al panel cuelga de esta comparación y tiene que poder probarse sin levantar
 * nada.
 *
 * Se declara en el ENTORNO (`PLATFORM_SUPERADMIN_EMAILS`, separados por coma)
 * y no en la base: sin tabla nueva, sin rol nuevo y, sobre todo, sin una
 * pantalla donde alguien pueda concederse el permiso a sí mismo. Cambiar quién
 * manda exige acceso al servidor, que es la barrera que uno quiere para eso.
 */
export function correosDeSuperadmin(crudo?: string | undefined): string[] {
  return (crudo ?? process.env.PLATFORM_SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export function esCorreoDeSuperadmin(
  correo: string | null | undefined,
  crudo?: string | undefined
): boolean {
  if (!correo) return false;
  const lista = correosDeSuperadmin(crudo);
  // Sin lista no hay superadmin: una variable vacía no abre la puerta a nadie.
  if (lista.length === 0) return false;
  return lista.includes(correo.trim().toLowerCase());
}
