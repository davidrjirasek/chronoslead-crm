/**
 * Catálogo del proveedor de IA (Ajustes → IA). Sin imports de servidor: lo
 * leen también los componentes de cliente.
 *
 * Un preset es solo una ayuda para no escribir la `base_url` a mano. Lo que
 * identifica al proveedor en la base es la `base_url`: cualquier API
 * compatible con la de OpenAI sirve (OpenRouter, OpenAI, Groq, un vLLM
 * propio…), que es la única frontera con el LLM que admite la constitución.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";

export const AI_PROVIDERS = ["openrouter", "openai_compatible"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_STATUSES = [
  "active",
  "paused_invalid_token",
  "paused_no_credit",
] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export type AiProviderPreset = {
  id: AiProviderId;
  label: string;
  /** Fija en el preset; `null` = la escribe el dueño. */
  baseUrl: string | null;
  modelPlaceholder: string;
  tokenPlaceholder: string;
};

export const AI_PROVIDER_PRESETS: Record<AiProviderId, AiProviderPreset> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: OPENROUTER_BASE_URL,
    modelPlaceholder: "anthropic/claude-sonnet-4.5",
    tokenPlaceholder: "sk-or-…",
  },
  openai_compatible: {
    id: "openai_compatible",
    label: "Otro compatible con OpenAI",
    baseUrl: null,
    modelPlaceholder: "gpt-4.1-mini",
    tokenPlaceholder: "sk-…",
  },
};

export const AI_STATUS_LABEL: Record<AiStatus, string> = {
  active: "Activo",
  paused_invalid_token: "Pausado: llave rechazada",
  paused_no_credit: "Pausado: sin saldo",
};

/** A qué preset corresponde una base URL (la del entorno o una guardada). */
export function presetDeBaseUrl(baseUrl: string): AiProviderId {
  return apiRoot(baseUrl) === apiRoot(OPENROUTER_BASE_URL)
    ? "openrouter"
    : "openai_compatible";
}

/**
 * La raíz `/v1` de una API OpenAI-compatible.
 *
 * La convención del repo es la base SIN `/v1` (`https://openrouter.ai/api`),
 * pero media internet publica la suya CON él (`https://api.groq.com/openai/v1`).
 * Se aceptan las dos: si ya termina en `/v1` no se duplica. Con la antigua
 * concatenación a ciegas, pegar la segunda daba `/v1/v1/chat/completions` y
 * un 404 que no explicaba nada.
 */
export function apiRoot(baseUrl: string): string {
  const sinBarra = baseUrl.trim().replace(/\/+$/, "");
  return /\/v1$/i.test(sinBarra) ? sinBarra : `${sinBarra}/v1`;
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${apiRoot(baseUrl)}/chat/completions`;
}

export function modelsUrl(baseUrl: string): string {
  return `${apiRoot(baseUrl)}/models`;
}

/** Los últimos 4 del token: lo único que viaja a la UI. */
export function last4(token: string): string {
  return token.slice(-4);
}

/**
 * 154 — Saca de la llave todo lo que no puede viajar en una cabecera HTTP.
 *
 * **Por qué existe:** el 25-nov-2026 el agente de Creativo 4D Group quedó
 * mudo con un 401 de OpenRouter que decía `Missing Authentication header`.
 * Ese mensaje NO es «la llave no sirve» —para eso contesta `User not
 * found.`— sino «la cabecera llegó malformada». La misma llave, copiada a
 * mano en una terminal, funcionaba.
 *
 * Lo guardado traía un carácter invisible EN EL MEDIO, de los que se cuelan
 * al copiar desde una página. `trim()` no lo veía porque solo mira las
 * puntas, se cifraba tal cual, y el fallo recién aparecía al usarla: la
 * pantalla decía «Activo» y el agente no contestaba.
 *
 * Ninguna llave de una API lleva espacios adentro, así que sacarlos todos
 * no puede romper una buena y sí salva una sucia.
 */
const INVISIBLES = new RegExp(
  // `\s` ya cubre espacio, tabulador, saltos, NBSP y BOM. El resto son
  // invisibles que para JavaScript NO son espacio y aun así rompen la
  // cabecera: control, guion suave, ancho cero y marcas de dirección.
  "[\\s\\u0000-\\u001f\\u007f\\u00ad\\u200b-\\u200f\\u2060]",
  "g"
);

export function limpiarLlave(valor: string): string {
  return valor.replace(INVISIBLES, "");
}

/**
 * ¿Tiene pinta de ser una llave de este proveedor? Solo para AVISAR en la
 * pantalla, NUNCA para rechazar: el formato lo decide el proveedor y cambia
 * sin avisar, y bloquear una llave buena por no reconocerla sería peor que
 * el problema que evita.
 */
export function pareceLlaveDe(provider: AiProviderId, token: string): boolean {
  if (provider !== "openrouter") return true;
  return limpiarLlave(token).startsWith("sk-or-");
}
