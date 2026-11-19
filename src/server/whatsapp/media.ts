import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { graphRequest, MetaApiError } from "@/lib/meta/client";
import {
  getCredentialsByOrg,
  type Credentials,
} from "@/server/whatsapp/credentials";
import { isForbiddenUploadMime } from "@/server/whatsapp/media-headers";
import { ZERNIO_BASE } from "@/server/zernio";
import { zernioConnectionsOfOrg } from "@/server/zernio/conexiones";

/**
 * 008 — Única frontera de media con la Graph API (constitución II: todo el
 * tráfico a Meta pasa por adaptadores dedicados) + persistencia en el volumen
 * local `MEDIA_DIR`. Meta expira sus archivos (~30 días, URLs de minutos):
 * el disco propio es la copia durable que la UI previsualiza.
 */

export type MediaKind = (typeof schema.mediaAsset.$inferSelect)["kind"];

/** Límites de la Cloud API por tipo (validados ANTES de tocar red, FR-007). */
export const MEDIA_LIMITS: Record<
  Exclude<MediaKind, "location" | "contacts">,
  { maxBytes: number; mimes: RegExp; label: string }
> = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    mimes: /^image\/(jpeg|png|webp)$/,
    label: "imagen (jpeg/png/webp, máx. 5 MB)",
  },
  sticker: {
    maxBytes: 100 * 1024,
    mimes: /^image\/webp$/,
    label: "sticker (webp, máx. 100 KB)",
  },
  audio: {
    maxBytes: 16 * 1024 * 1024,
    mimes: /^audio\/(aac|mp4|mpeg|amr|ogg|opus)/,
    label: "audio (aac/mp4/mpeg/amr/ogg, máx. 16 MB)",
  },
  video: {
    maxBytes: 16 * 1024 * 1024,
    mimes: /^video\/(mp4|3gpp)$/,
    label: "video (mp4/3gpp, máx. 16 MB)",
  },
  document: {
    maxBytes: 100 * 1024 * 1024,
    mimes: /^[\w.-]+\/[\w.+-]+$/,
    label: "documento (máx. 100 MB)",
  },
};

/** Clasifica un MIME de archivo saliente al tipo de mensaje de la Cloud API. */
export function kindFromMime(mime: string): "image" | "audio" | "video" | "document" {
  if (MEDIA_LIMITS.image.mimes.test(mime)) return "image";
  if (MEDIA_LIMITS.audio.mimes.test(mime)) return "audio";
  if (MEDIA_LIMITS.video.mimes.test(mime)) return "video";
  return "document";
}

export class MediaValidationError extends Error {
  code: "too_large" | "unsupported_type";
  constructor(code: MediaValidationError["code"], message: string) {
    super(message);
    this.name = "MediaValidationError";
    this.code = code;
  }
}

/**
 * Valida MIME y tamaño para envío; devuelve el kind resuelto. Los formatos
 * que WhatsApp no acepta como su tipo nativo (p. ej. image/bmp) van como
 * documento — igual que hace la app de WhatsApp. HTML y SVG no van ni como
 * documento (#78): el navegador de quien los abra los trataría como una
 * página, y se servirían desde el origen del CRM.
 */
export function validateOutgoing(mime: string, sizeBytes: number) {
  if (!/^[\w.-]+\/[\w.+-]+$/.test(mime)) {
    throw new MediaValidationError("unsupported_type", "Tipo de archivo no reconocido");
  }
  if (isForbiddenUploadMime(mime)) {
    throw new MediaValidationError(
      "unsupported_type",
      "Los archivos HTML y SVG no se pueden enviar como adjunto: un navegador los abriría como página. Conviértelo a PDF o a imagen"
    );
  }
  const kind = kindFromMime(mime);
  const limit = MEDIA_LIMITS[kind];
  if (sizeBytes > limit.maxBytes) {
    throw new MediaValidationError(
      "too_large",
      `El archivo excede el límite de ${limit.label}`
    );
  }
  return kind;
}

/* ---------- Disco local ---------- */

function assertSafeSegment(s: string): void {
  if (!/^[\w.-]+$/.test(s)) throw new Error(`segmento de ruta inválido: ${s}`);
}

/** Ruta absoluta del archivo de un asset dentro de MEDIA_DIR. */
export function mediaFilePath(organizationId: string, assetId: string): string {
  assertSafeSegment(organizationId);
  assertSafeSegment(assetId);
  return path.join(getEnv().MEDIA_DIR, organizationId, assetId);
}

export async function saveMediaFile(
  organizationId: string,
  assetId: string,
  data: Buffer | Uint8Array
): Promise<string> {
  const file = mediaFilePath(organizationId, assetId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return path.join(organizationId, assetId); // ruta relativa persistida en BD
}

export async function readMediaFile(
  organizationId: string,
  assetId: string
): Promise<Buffer> {
  return readFile(mediaFilePath(organizationId, assetId));
}

/**
 * 018 — Borra el archivo de un asset. Sin error si ya no estaba: quien lo
 * llama está deshaciendo una copia que sobró, y un archivo que no existe es
 * justo el estado al que quiere llegar.
 */
export async function deleteMediaFile(
  organizationId: string,
  assetId: string
): Promise<void> {
  await rm(mediaFilePath(organizationId, assetId), { force: true });
}

/* ---------- Descarga desde Graph (entrantes y echoes) ---------- */

type GraphMediaMeta = { url?: string; mime_type?: string; file_size?: number };

export class MediaFetchError extends Error {
  /** true si Meta ya no tiene el archivo (expirado/borrado) — no reintentar. */
  gone: boolean;
  constructor(message: string, gone = false) {
    super(message);
    this.name = "MediaFetchError";
    this.gone = gone;
  }
}

/**
 * Descarga un media de Graph: GET {mediaId} → url efímera → GET con Bearer.
 * El token JAMÁS sale del servidor.
 */
export async function downloadGraphMedia(
  token: string,
  waMediaId: string,
  maxBytes: number = MEDIA_LIMITS.document.maxBytes
): Promise<{ data: Buffer; mimeType: string | null; fileSize: number }> {
  let meta: GraphMediaMeta;
  try {
    meta = await graphRequest<GraphMediaMeta>(waMediaId, { token });
  } catch (err) {
    const gone = err instanceof MetaApiError && err.status === 404;
    throw new MediaFetchError("Meta no entregó la metadata del adjunto", gone);
  }
  if (!meta.url) throw new MediaFetchError("Meta no entregó URL del adjunto");
  if (meta.file_size && meta.file_size > maxBytes) {
    throw new MediaFetchError("El adjunto excede el límite de tamaño", true);
  }

  let res: Response;
  try {
    res = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new MediaFetchError("No se pudo descargar el adjunto");
  }
  if (!res.ok) {
    throw new MediaFetchError(
      `La descarga devolvió ${res.status}`,
      res.status === 404 || res.status === 410
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new MediaFetchError("El adjunto excede el límite de tamaño", true);
  }
  return {
    data: buf,
    mimeType: meta.mime_type ?? res.headers.get("content-type"),
    fileSize: buf.byteLength,
  };
}

/**
 * 153 — ¿La URL es del host de Zernio? Decide si se le manda la llave.
 *
 * Se compara el HOST completo, no un `includes`: `zernio.com.ejemplo.net`
 * contiene la cadena y no es Zernio.
 */
export function esDeZernio(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const base = new URL(ZERNIO_BASE).hostname.toLowerCase();
    return host === base || host.endsWith(`.${base}`);
  } catch {
    return false;
  }
}

/**
 * 149 — Bajar un adjunto de una URL directa, sin Graph.
 *
 * Zernio entrega el archivo como una URL temporal en vez de un media id. Es
 * el mismo trabajo que `downloadGraphMedia` menos la parte de Meta: sin token,
 * sin consulta previa de metadata. Los límites son los MISMOS a propósito —dos
 * caminos con techos distintos es la forma de que dentro de medio año uno
 * acepte lo que el otro rechaza sin que nadie se entere.
 */
export async function downloadUrlMedia(
  url: string,
  maxBytes: number = MEDIA_LIMITS.document.maxBytes,
  /**
   * 153 — La llave de Zernio, SOLO si la URL es de Zernio.
   *
   * Sus enlaces de media piden autenticación: sin ella contestan 401, que es
   * exactamente lo que devolvieron la primera foto real (19-nov-2026). Se
   * manda como `Authorization: Bearer`, el mismo esquema que su API.
   *
   * El guardia del host no es ceremonia: este mismo camino baja también
   * adjuntos de Meta, y mandarle la llave de Zernio a un host ajeno sería
   * regalar la credencial del cliente a quien ponga una URL en un webhook.
   */
  token?: string | null
): Promise<{ data: Buffer; mimeType: string | null; fileSize: number }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: token && esDeZernio(url) ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new MediaFetchError("No se pudo descargar el adjunto");
  }
  if (!res.ok) {
    // Una URL temporal que ya caducó no se reintenta: no va a volver.
    throw new MediaFetchError(
      `La descarga devolvió ${res.status}`,
      res.status === 403 || res.status === 404 || res.status === 410
    );
  }

  // El `content-length` evita bajar entero algo que se va a descartar; igual
  // se vuelve a medir después, porque puede faltar o mentir.
  const declarado = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declarado) && declarado > maxBytes) {
    throw new MediaFetchError("El adjunto excede el límite de tamaño", true);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new MediaFetchError("El adjunto excede el límite de tamaño", true);
  }
  return {
    data: buf,
    mimeType: res.headers.get("content-type"),
    fileSize: buf.byteLength,
  };
}

/**
 * Garantiza que el asset esté en disco (`fetchStatus=available`).
 * Se usa en la descarga in-process post-ingesta Y on-demand desde la ruta de
 * media. Nunca lanza hacia el webhook: el que llama decide qué hacer con el
 * resultado. Devuelve el asset actualizado o null si no se pudo.
 */
/**
 * 149 — La rama de Graph, extraída para que `ensureAssetAvailable` se lea de
 * un vistazo: de dónde sale el archivo es UNA decisión, y se ve en una línea.
 *
 * Las credenciales son del transporte nativo. Por Zernio `getCredentialsByOrg`
 * devuelve null por diseño (139) — y por eso ahí se usa la otra rama.
 */
async function descargarPorGraph(
  organizationId: string,
  waMediaId: string
): Promise<{ data: Buffer; mimeType: string | null; fileSize: number }> {
  const creds = await getCredentialsByOrg(organizationId);
  if (!creds) {
    throw new MediaFetchError("Esta organización no tiene credenciales de Graph");
  }
  return downloadGraphMedia(creds.token, waMediaId);
}

/**
 * 153 — La llave de Zernio de esta organización, solo si hace falta.
 *
 * No se consulta cuando la URL no es de Zernio: ni una lectura de más ni un
 * secreto cargado en memoria sin motivo.
 */
async function llaveDeZernio(
  organizationId: string,
  url: string
): Promise<string | null> {
  if (!esDeZernio(url)) return null;
  const conexiones = await zernioConnectionsOfOrg(organizationId);
  return conexiones[0]?.token ?? null;
}

export async function ensureAssetAvailable(
  organizationId: string,
  assetId: string
): Promise<typeof schema.mediaAsset.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.mediaAsset)
    .where(eq(schema.mediaAsset.id, assetId))
    .limit(1);
  const asset = rows[0];
  if (!asset || asset.organizationId !== organizationId) return null;
  if (asset.fetchStatus === "available") return asset;
  // location/contacts no tienen binario, y sin ninguna de las dos fuentes
  // tampoco hay nada que bajar.
  if (!asset.waMediaId && !asset.sourceUrl) return null;

  try {
    const { data, mimeType, fileSize } = asset.waMediaId
      ? await descargarPorGraph(organizationId, asset.waMediaId)
      : await downloadUrlMedia(
          asset.sourceUrl!,
          MEDIA_LIMITS.document.maxBytes,
          await llaveDeZernio(organizationId, asset.sourceUrl!)
        );
    const storagePath = await saveMediaFile(organizationId, assetId, data);
    const updated = await db
      .update(schema.mediaAsset)
      .set({
        storagePath,
        mimeType: asset.mimeType ?? mimeType,
        fileSize,
        fetchStatus: "available",
        fetchError: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAsset.id, assetId))
      .returning();
    return updated[0] ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.mediaAsset)
      .set({ fetchStatus: "failed", fetchError: message, updatedAt: new Date() })
      .where(eq(schema.mediaAsset.id, assetId));
    console.warn(`[media] descarga del asset ${assetId} falló: ${message}`);
    return null;
  }
}

/* ---------- Subida a Graph (salientes) ---------- */

/**
 * Sube un archivo a Graph (`POST /{phone_number_id}/media`, multipart) y
 * devuelve el media id para usar en /messages. Errores → MetaApiError (la
 * capa de envío los traduce con las mismas reglas que el texto).
 */
export async function uploadGraphMedia(
  credentials: Credentials,
  file: { data: Buffer | Uint8Array; mimeType: string; fileName?: string }
): Promise<string> {
  const env = getEnv();
  const url = `${env.META_GRAPH_BASE_URL}/${env.META_GRAPH_API_VERSION}/${credentials.phoneNumberId}/media`;
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", file.mimeType);
  const bytes = new Uint8Array(file.data);
  form.set(
    "file",
    new Blob([bytes], { type: file.mimeType }),
    file.fileName ?? "adjunto"
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.token}` },
      body: form,
    });
  } catch (cause) {
    throw new MetaApiError("No se pudo contactar la API de Meta", {
      status: 0,
      details: cause,
    });
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number; type?: string } })
      ?.error;
    throw new MetaApiError(err?.message ?? `Meta respondió ${res.status}`, {
      status: res.status,
      code: err?.code ?? null,
      type: err?.type ?? null,
      details: json ?? text,
    });
  }
  const id = (json as { id?: string })?.id;
  if (!id) {
    throw new MetaApiError("Meta no devolvió ID del media subido", {
      status: res.status,
    });
  }
  return id;
}
