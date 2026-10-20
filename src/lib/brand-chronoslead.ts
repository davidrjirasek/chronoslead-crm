/**
 * 107 — La marca ChronosLead.
 *
 * El isotipo es un archivo, no un dibujo del código: `public/isotipo.png`, la
 * C isométrica en capas que diseñó el dueño. Aquí solo vive la pregunta de si
 * esta instancia es la plataforma.
 */

/**
 * ¿Esta instancia se llama ChronosLead? Solo entonces se dibuja el isotipo:
 * una organización que puso su propio nombre no debe ver el logo de la
 * plataforma en su barra lateral ni en su pestaña — lo suyo es su inicial o el
 * icono que suba.
 */
export function isChronosLeadName(name: string): boolean {
  return name.trim().toLowerCase().replace(/\s+/g, "") === "chronoslead";
}
