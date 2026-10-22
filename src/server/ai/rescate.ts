/**
 * Rescate de una respuesta que vino sin el envoltorio.
 *
 * El agente le pide al modelo un objeto JSON con la acción a tomar. Cuando el
 * modelo contesta la frase suelta en vez del objeto, `chatJson` reintenta tres
 * veces y, si las tres vuelven igual, el turno se perdía: el cliente se
 * quedaba sin respuesta aunque el modelo hubiera escrito algo perfecto.
 *
 * Eso contradice lo que este proyecto se exige a sí mismo: «un hipo del
 * proveedor nunca tumba el turno». Pasó en vivo el 21-oct-2026 con una nota de
 * voz: la transcripción funcionó, el modelo contestó bien, y la respuesta se
 * descartó por no venir envuelta.
 *
 * Así que si lo que vino es una frase que se le puede decir a una persona, se
 * manda. Si es un JSON a medio romper o un texto que delata la maquinaria, no:
 * ahí es mejor el silencio y el aviso al equipo.
 */

/** Más largo que esto no es un mensaje de chat; es otra cosa. */
const LARGO_MAXIMO = 1200;

/**
 * Lo único que delata el mecanismo es hablar del formato. Si el modelo escribió
 * «no puedo devolver JSON», eso no se le muestra a un cliente.
 */
const DELATA_LA_MAQUINARIA = /\bjson\b|"action"\s*:|\bschema\b|\besquema del\b/i;

export function respuestaRescatable(raw: string | null | undefined): string | null {
  const texto = (raw ?? "").trim();
  if (!texto) return null;

  // Un intento de JSON roto no es una frase: es el envoltorio a medio escribir.
  if (/^[[{]/.test(texto) || texto.startsWith("```")) return null;

  if (DELATA_LA_MAQUINARIA.test(texto)) return null;
  if (texto.length > LARGO_MAXIMO) return null;

  return texto;
}
