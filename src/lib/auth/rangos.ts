/**
 * 136 — Rangos dentro de una organización, y la única regla que los gobierna.
 *
 * `canConfigure()` (de upstream) devuelve lo mismo para `owner` y `admin`: el
 * sistema no tenía jerarquía, tenía dos clases de configurador. Eso dejaba que
 * un administrador generara el enlace de acceso del propietario, lo consumiera
 * y se quedara con la cuenta — y consumirlo BORRA las sesiones de la víctima,
 * así que la toma de control era limpia e inmediata.
 *
 * Vive en `lib/` —como `roles.ts`— porque lo consultan los dos lados: el
 * panel (cliente, para no dibujar lo que no corresponde) y las rutas
 * (servidor, que es donde de verdad se aplica).
 *
 * La regla, una sola:
 *
 *   Nadie actúa sobre un rango igual o superior al suyo.
 *
 * Vive en el servidor a propósito. Esconder el botón no protege nada: el botón
 * solo redacta un pedido, y ese pedido se puede repetir a mano cambiándole el
 * identificador. El guion de aislamiento lo comprueba llamando las rutas
 * directamente, sin pasar por la pantalla.
 */

export const RANGOS = { owner: 3, admin: 2, member: 1 } as const;

export type Rol = keyof typeof RANGOS;

/** Los roles que un humano puede ASIGNAR. `owner` se fija en el alta y no se cede. */
export const ROLES_ASIGNABLES = ["admin", "member"] as const satisfies readonly Rol[];

export function esRol(valor: string | null | undefined): valor is Rol {
  return valor === "owner" || valor === "admin" || valor === "member";
}

export function rango(rol: string | null | undefined): number {
  return esRol(rol) ? RANGOS[rol] : 0;
}

/**
 * ¿Puede `actor` actuar sobre `objetivo`? Estrictamente mayor, nunca igual:
 * dos administradores no se tocan entre ellos, y nadie se quita a sí mismo
 * (su propio rango nunca es menor que el propio).
 */
export function puedeActuarSobre(
  rolActor: string | null | undefined,
  rolObjetivo: string | null | undefined
): boolean {
  const actor = rango(rolActor);
  const objetivo = rango(rolObjetivo);
  if (actor === 0 || objetivo === 0) return false;
  return actor > objetivo;
}

/**
 * ¿Puede `actor` ASIGNAR el rol `destino`? No se puede nombrar a alguien de
 * rango igual o superior al propio: un administrador no fabrica administradores
 * —sería esquivar la regla de arriba creando un par y actuando desde él.
 */
export function puedeAsignarRol(
  rolActor: string | null | undefined,
  destino: string | null | undefined
): boolean {
  const actor = rango(rolActor);
  const nuevo = rango(destino);
  if (actor === 0 || nuevo === 0) return false;
  return actor > nuevo;
}

/** Quién puede entrar al panel de equipo. Miembro no: solo atiende la Bandeja. */
export function puedeGobernarEquipo(rol: string | null | undefined): boolean {
  return rango(rol) >= RANGOS.admin;
}
