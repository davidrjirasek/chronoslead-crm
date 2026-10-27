/**
 * 122 — Guardar el consumo que el proveedor ya nos manda.
 *
 * Cada respuesta del proveedor trae un objeto `usage` con los tokens del
 * pedido y de la respuesta. Hasta hoy se leía solo el texto y el resto se
 * descartaba, así que no había forma de saber cuánto gasta cada cliente sin
 * ir a preguntarle a cada proveedor con la llave de cada organización.
 *
 * Dos decisiones que sostienen el resto:
 *
 * 1 · **Una fila por intento.** Un turno que falla el formato gasta hasta
 *     tres llamadas. Contar por turno escondería justamente el gasto que
 *     interesa mirar: el de las respuestas que se tiraron.
 *
 * 2 · **Esto JAMÁS tumba un turno.** Si falla la escritura, se traga el
 *     error. Perder una medición es molesto; perder la respuesta de un
 *     cliente porque no se pudo anotar cuánto costó es inaceptable.
 */
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";

export type ConsumoCrudo = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type Consumo = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type PropositoDeConsumo = "agente" | "juez";
export type ResultadoDeConsumo = "ok" | "sin_json" | "no_cumple_esquema" | "error";

/**
 * Normaliza lo que vino del proveedor.
 *
 * Los proveedores del dialecto OpenAI mandan `usage`, pero no todos mandan
 * los tres números ni siempre. Lo que falte vale 0, y si falta el total se
 * deduce de las partes: un total inventado hacia arriba abulta la factura
 * que alguien va a mirar.
 */
export function normalizarConsumo(crudo: unknown): Consumo | null {
  if (!crudo || typeof crudo !== "object") return null;
  const u = crudo as ConsumoCrudo;
  const entrada = entero(u.prompt_tokens);
  const salida = entero(u.completion_tokens);
  const total = entero(u.total_tokens) || entrada + salida;
  if (entrada === 0 && salida === 0 && total === 0) return null;
  return { promptTokens: entrada, completionTokens: salida, totalTokens: total };
}

function entero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/**
 * Anota un intento. Sin organización no se anota: el consumo es de alguien o
 * no se guarda — una fila sin dueño no se puede cobrar ni atribuir.
 */
export async function anotarConsumo(opts: {
  organizationId: string | undefined;
  proposito: PropositoDeConsumo;
  resultado: ResultadoDeConsumo;
  model: string;
  consumo: Consumo | null;
}): Promise<void> {
  if (!opts.organizationId || !opts.consumo) return;
  try {
    await getDb().insert(schema.aiUsage).values({
      id: newId("aiUsage"),
      organizationId: opts.organizationId,
      proposito: opts.proposito,
      resultado: opts.resultado,
      model: opts.model,
      promptTokens: opts.consumo.promptTokens,
      completionTokens: opts.consumo.completionTokens,
      totalTokens: opts.consumo.totalTokens,
    });
  } catch (err) {
    // Se avisa y se sigue: la medición es secundaria frente al turno.
    console.warn(
      `[consumo] no se pudo anotar: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
