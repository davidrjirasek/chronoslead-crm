/**
 * 104 — En qué estado está una organización.
 *
 * Pura: recibe los datos y la fecha de hoy, no consulta nada. Todo el acceso a
 * la plataforma cuelga de esta función, así que tiene que poder probarse en sus
 * bordes sin levantar nada.
 */

export type EstadoOrganizacion =
  | { estado: "activa" }
  /** Vencida pero dentro del plazo: entra y funciona, con aviso. */
  | { estado: "gracia"; diasRestantes: number }
  | { estado: "suspendida"; motivo: "impago" }
  /** Cortada a mano por el operador. Pagar NO la levanta. */
  | { estado: "suspendida"; motivo: "manual"; razon: string | null };

export const DIAS_DE_GRACIA_POR_DEFECTO = 7;

export function diasDeGracia(): number {
  const raw = Number(process.env.DIAS_DE_GRACIA);
  return Number.isFinite(raw) && raw >= 0 ? raw : DIAS_DE_GRACIA_POR_DEFECTO;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Días completos entre dos instantes, contando solo la fecha (UTC). */
function diasEntre(desde: Date, hasta: Date): number {
  const d = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const h = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.floor((h - d) / MS_POR_DIA);
}

export function estadoDeOrganizacion(
  org: {
    paidThrough: Date | null;
    suspendedAt: Date | null;
    suspendedReason: string | null;
  },
  ahora: Date,
  gracia: number = diasDeGracia()
): EstadoOrganizacion {
  // La suspensión manual gana sobre todo, incluso sobre una fecha pagada al
  // día: se puso por un motivo que no es el dinero y la quita quien la puso.
  if (org.suspendedAt) {
    return { estado: "suspendida", motivo: "manual", razon: org.suspendedReason };
  }

  // Sin fecha, activa: un cliente nuevo o de cortesía no se queda fuera por un
  // campo vacío.
  if (!org.paidThrough) return { estado: "activa" };

  const vencidaHace = diasEntre(org.paidThrough, ahora);
  if (vencidaHace <= 0) return { estado: "activa" };
  if (vencidaHace <= gracia) {
    return { estado: "gracia", diasRestantes: gracia - vencidaHace };
  }
  return { estado: "suspendida", motivo: "impago" };
}

export function puedeEntrar(estado: EstadoOrganizacion): boolean {
  return estado.estado !== "suspendida";
}

/** Lo que se le dice a quien intenta entrar. Sin detalles de facturación. */
export function mensajeDeSuspension(estado: EstadoOrganizacion): string {
  if (estado.estado !== "suspendida") return "";
  return estado.motivo === "impago"
    ? "Esta cuenta está suspendida por falta de pago. Tus datos siguen intactos."
    : "Esta cuenta está suspendida. Contacta con el administrador.";
}
