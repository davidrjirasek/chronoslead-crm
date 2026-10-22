import { readMediaFile } from "@/server/whatsapp/media";

/**
 * 112 — Transcribir las notas de voz que llegan por WhatsApp.
 *
 * Por qué existe: en este mercado la gente manda audios constantemente. Un
 * agente que no los entiende no es un agente con un detalle pendiente — es un
 * agente inútil en la mitad de las conversaciones.
 *
 * CONECTOR OPCIONAL (Constitución II, patrón ADR-001). Apagado por defecto,
 * aislado tras este adaptador, y con camino sin él: cuando está apagado o
 * falla, el mensaje sigue llegando al agente descrito —«el cliente envió una
 * nota de voz»— y la conversación continúa. Su fallo nunca bloquea nada.
 *
 * Deliberadamente NO va por el adaptador de chat: su `ChatMessage` solo acepta
 * texto, y volverlo multimodal tocaría el núcleo heredado en su pieza más
 * delicada. Esto es una frontera aparte, con un contrato de una sola línea:
 * audio entra, texto sale.
 *
 * Habla el dialecto de OpenAI (`POST /audio/transcriptions`, multipart), que
 * es el que exponen casi todos: OpenAI, Groq, Deepgram y compatibles. Quien lo
 * configure elige proveedor sin tocar este archivo.
 */

/** Techo de lo que se manda a transcribir. Una nota de voz no pesa esto. */
export const MAX_BYTES = 20 * 1024 * 1024;

/** Más allá de esto no es una nota de voz: es un archivo y no lo procesamos. */
export const MAX_SEGUNDOS_ESTIMADOS = 600;

export type Transcripcion =
  | { ok: true; texto: string }
  | { ok: false; motivo: "apagado" | "sin_credenciales" | "demasiado_grande" | "proveedor" };

export type ConfigTranscripcion = {
  activa: boolean;
  baseUrl: string;
  apiKey: string;
  modelo: string;
  idioma: string | null;
};

/**
 * La configuración, leída del entorno.
 *
 * Es de la PLATAFORMA y no de cada organización, a diferencia de la llave de
 * IA: el costo por minuto es marginal y pedirle a cada cliente una credencial
 * más para algo que debería ser invisible no compensa.
 */
export function configDeTranscripcion(
  env: Record<string, string | undefined> = process.env
): ConfigTranscripcion {
  const activa = (env.TRANSCRIPCION ?? "").trim().toLowerCase() === "on";
  return {
    activa,
    baseUrl: (env.TRANSCRIPCION_BASE_URL ?? "https://api.groq.com/openai/v1").trim(),
    apiKey: (env.TRANSCRIPCION_API_KEY ?? "").trim(),
    modelo: (env.TRANSCRIPCION_MODEL ?? "whisper-large-v3-turbo").trim(),
    // Fijar el idioma mejora la precisión y evita que una nota corta en
    // español se interprete como portugués, que es el vecino fonético.
    idioma: (env.TRANSCRIPCION_IDIOMA ?? "es").trim() || null,
  };
}

/** `true` si el conector está encendido Y tiene con qué trabajar. */
export function transcripcionDisponible(
  cfg: ConfigTranscripcion = configDeTranscripcion()
): boolean {
  return cfg.activa && cfg.apiKey.length > 0;
}

/**
 * Qué se le manda al proveedor. Separado del envío para poder probarlo sin
 * red: lo que importa es que el multipart lleve el archivo, el modelo y el
 * idioma, y que el nombre del archivo conserve la extensión —varios
 * proveedores deciden el formato por ahí y rechazan un `blob` sin nombre.
 */
export function cuerpoDeTranscripcion(
  audio: Uint8Array,
  mime: string,
  cfg: ConfigTranscripcion
): FormData {
  const fd = new FormData();
  fd.append("file", new Blob([audio as BlobPart], { type: mime }), nombreDeArchivo(mime));
  fd.append("model", cfg.modelo);
  fd.append("response_format", "json");
  if (cfg.idioma) fd.append("language", cfg.idioma);
  return fd;
}

/** WhatsApp manda `audio/ogg; codecs=opus`; el nombre tiene que decir `.ogg`. */
export function nombreDeArchivo(mime: string): string {
  const base = (mime.split(";")[0] ?? "").trim().toLowerCase();
  const ext =
    base === "audio/ogg"
      ? "ogg"
      : base === "audio/mpeg"
        ? "mp3"
        : base === "audio/mp4" || base === "audio/m4a"
          ? "m4a"
          : base === "audio/wav" || base === "audio/x-wav"
            ? "wav"
            : base === "audio/webm"
              ? "webm"
              : "ogg";
  return `nota-de-voz.${ext}`;
}

/** La URL del endpoint, tolerando que la base venga con o sin barra final. */
export function urlDeTranscripcion(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
}

/**
 * Transcribe un adjunto de audio ya guardado en disco.
 *
 * Nunca lanza: cualquier problema vuelve como `ok: false` con el motivo, y
 * quien llama sigue su camino. Un proveedor caído no puede dejar sin respuesta
 * a un cliente.
 */
export async function transcribirAudio(input: {
  organizationId: string;
  assetId: string;
  mimeType: string | null;
  cfg?: ConfigTranscripcion;
  timeoutMs?: number;
}): Promise<Transcripcion> {
  const cfg = input.cfg ?? configDeTranscripcion();
  if (!cfg.activa) return { ok: false, motivo: "apagado" };
  if (!cfg.apiKey) return { ok: false, motivo: "sin_credenciales" };

  let audio: Uint8Array;
  try {
    audio = await readMediaFile(input.organizationId, input.assetId);
  } catch {
    return { ok: false, motivo: "proveedor" };
  }
  if (audio.byteLength > MAX_BYTES) return { ok: false, motivo: "demasiado_grande" };

  const mime = input.mimeType ?? "audio/ogg";
  const control = AbortSignal.timeout(input.timeoutMs ?? 60_000);

  try {
    const res = await fetch(urlDeTranscripcion(cfg.baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: cuerpoDeTranscripcion(audio, mime, cfg),
      signal: control,
    });
    if (!res.ok) {
      // El cuerpo del error puede traer la llave en un mensaje del proveedor:
      // se registra el código y nada más.
      console.error(`[transcripción] el proveedor respondió ${res.status}`);
      return { ok: false, motivo: "proveedor" };
    }
    const body = (await res.json()) as { text?: unknown };
    const texto = typeof body.text === "string" ? body.text.trim() : "";
    if (!texto) return { ok: false, motivo: "proveedor" };
    return { ok: true, texto };
  } catch (err) {
    console.error(`[transcripción] no se pudo transcribir: ${err}`);
    return { ok: false, motivo: "proveedor" };
  }
}
