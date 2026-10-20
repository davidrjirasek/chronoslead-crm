/**
 * 102 — De dónde entró un evento de webhook, y en qué organización le está
 * permitido escribir.
 *
 * La ingesta enruta por lo que viene DENTRO del cuerpo (`phone_number_id`).
 * Sin este guardián, una URL por organización es decorativa: bastaría entrar
 * por la puerta propia escribiendo el identificador ajeno para meter un
 * mensaje en la bandeja de otro.
 */
export type Procedencia =
  /** Entró por `/api/webhooks/wa/{organizationId}/{firma}`. */
  | { via: "organizacion"; organizationId: string }
  /** URL compartida de la instancia; solo existe en edición de un solo negocio. */
  | { via: "legacy" }
  /** Mocks de desarrollo y reprocesos internos: no vienen de la red pública. */
  | { via: "interna" };

export function puedeEscribirEn(
  procedencia: Procedencia,
  organizationIdDelCuerpo: string
): boolean {
  switch (procedencia.via) {
    case "organizacion":
      return procedencia.organizationId === organizationIdDelCuerpo;
    case "legacy":
    case "interna":
      return true;
  }
}

/** Para los logs: sin identificadores de negocio ni datos personales. */
export function describeProcedencia(p: Procedencia): string {
  return p.via === "organizacion" ? "puerta de organización" : p.via;
}
