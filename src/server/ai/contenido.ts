/**
 * 112 — Qué lee el modelo de cada mensaje del historial.
 *
 * El turno se armaba con `history.filter((m) => m.text)`: un mensaje sin texto
 * —una nota de voz, una foto— **desaparecía**. Y el turno que ese mismo
 * mensaje disparaba llegaba al modelo con una conversación que terminaba en su
 * propia respuesta anterior. Sin nada nuevo a qué contestar, el proveedor
 * devolvía vacío; el vacío se tomaba por fallo y la IA quedaba en pausa.
 *
 * Síntoma real (21-oct-2026, primera conversación de verdad): el prospecto
 * mandó un audio de nueve segundos, el agente no volvió a hablar, y los tres
 * mensajes de texto que mandó después tampoco lo despertaron.
 *
 * Describir no es transcribir. El agente sigue sin saber qué dice la nota de
 * voz —eso es otro trabajo, con otro costo—. Pero sabe que llegó, y puede
 * pedir que se lo escriban en vez de desaparecer. En este mercado la gente
 * manda audios todo el tiempo: desaparecer no es una opción.
 */

/** Cómo se le nombra al cliente lo que mandó. En su idioma, no en el de Meta. */
const COMO_SE_LLAMA: Record<string, string> = {
  audio: "una nota de voz",
  voice: "una nota de voz",
  image: "una imagen",
  video: "un video",
  document: "un documento",
  sticker: "un sticker",
  location: "una ubicación",
  contacts: "un contacto",
};

export type MensajeDelHistorial = {
  type: string | null;
  text: string | null;
  direction: string;
};

/**
 * El texto del mensaje, o una descripción de lo que llegó cuando no hay texto.
 * `null` significa que el mensaje no aporta nada y se omite.
 *
 * Lo SALIENTE sin texto sí se omite: que el negocio haya mandado una imagen no
 * le cambia el turno al agente, y narrarlo solo gasta contexto.
 */
export function contenidoParaElModelo(m: MensajeDelHistorial): string | null {
  const texto = m.text?.trim();
  if (texto) return texto;
  if (m.direction !== "in") return null;

  const que = COMO_SE_LLAMA[(m.type ?? "").toLowerCase()] ?? "un archivo";
  return `[El cliente envió ${que}. No podés verlo ni escucharlo.]`;
}
