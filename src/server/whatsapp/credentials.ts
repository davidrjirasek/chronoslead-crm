import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { scoped } from "@/lib/db/tenant";
import {
  columnasDelSecreto,
  secretoDeLaFila,
} from "@/server/zernio/secreto-guardado";

/**
 * 139 — Las credenciales del transporte NATIVO (`source: "meta"`): la Cloud
 * API directa. `wabaId` y `phoneNumberId` siguen siendo obligatorios aquí
 * porque en este transporte siempre existen, y los 44 sitios que los usan no
 * tienen que aprender a dudar de ellos.
 *
 * El transporte por Zernio tiene su propia forma (`ZernioWhatsapp`) y su
 * propio accesor: estas funciones NUNCA devuelven una fila de Zernio. Así el
 * camino que ya usan los clientes conectados no cambia de comportamiento, y
 * un `null` de aquí significa «esta organización no tiene Cloud API directa»,
 * que es justo lo que quien llama necesita saber.
 */
export type Credentials = {
  id: string;
  organizationId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: "connected" | "reconnect_required";
  token: string;
};

type Row = typeof schema.metaCredentials.$inferSelect;

/**
 * 139 — Devuelve null si la fila no es del transporte nativo, o si le falta
 * alguno de los dos identificadores de Meta. El filtro vive aquí, en el único
 * sitio que convierte filas, y no repetido en cada consulta.
 */
function toCredentials(row: Row): Credentials | null {
  if (row.source !== "meta" || !row.wabaId || !row.phoneNumberId) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    status: row.status,
    token: decryptSecret({
      cipher: row.tokenCipher,
      iv: row.tokenIv,
      tag: row.tokenTag,
    }),
  };
}

/** Resuelve la conexión por phone_number_id (enrutamiento del webhook). */
export async function getCredentialsByPhoneNumberId(
  phoneNumberId: string
): Promise<Credentials | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(eq(schema.metaCredentials.phoneNumberId, phoneNumberId))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

/** Resuelve la conexión por WABA ID (eventos a nivel WABA, ej. plantillas). */
export async function getCredentialsByWabaId(
  wabaId: string
): Promise<Credentials | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(eq(schema.metaCredentials.wabaId, wabaId))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

export async function getCredentialsByOrg(
  organizationId: string
): Promise<Credentials | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(scoped(schema.metaCredentials.organizationId, organizationId))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

export async function saveCredentials(input: {
  organizationId: string;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
}): Promise<void> {
  const db = getDb();
  const enc = encryptSecret(input.token);
  await db
    .insert(schema.metaCredentials)
    .values({
      id: newId("credentials"),
      organizationId: input.organizationId,
      // 139: explícito, no por el default de la columna.
      source: "meta",
      wabaId: input.wabaId,
      accountRef: null,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber: input.displayPhoneNumber ?? null,
      verifiedName: input.verifiedName ?? null,
      tokenCipher: enc.cipher,
      tokenIv: enc.iv,
      tokenTag: enc.tag,
      status: "connected",
    })
    .onConflictDoUpdate({
      target: [schema.metaCredentials.organizationId],
      set: {
        // 139: conectar por Cloud API sobre una fila de Zernio la convierte;
        // si no se fijara, quedaría `source: "zernio"` con credenciales de
        // Meta y el envío saldría por el transporte equivocado.
        source: "meta",
        accountRef: null,
        ...columnasDelSecreto(null),
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        verifiedName: input.verifiedName ?? null,
        tokenCipher: enc.cipher,
        tokenIv: enc.iv,
        tokenTag: enc.tag,
        status: "connected",
        updatedAt: new Date(),
      },
    });
}

/**
 * Desconectar el número: borra las credenciales cifradas de la organización.
 *
 * No toca conversaciones, contactos ni leads — son de la organización, no de
 * la conexión. Idempotente: sin fila, no hay nada que borrar.
 */
export async function desconectarCanal(organizationId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.metaCredentials)
    .where(scoped(schema.metaCredentials.organizationId, organizationId));
}

/** Marca la conexión como vencida (token inválido detectado en runtime). */
export async function markReconnectRequired(
  organizationId: string
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.metaCredentials)
    .set({ status: "reconnect_required", updatedAt: new Date() })
    .where(scoped(schema.metaCredentials.organizationId, organizationId));
}

/* ------------------------------------------------------------------ *
 * 139 — WhatsApp por Zernio (`source: "zernio"`)
 *
 * Para que un número siga viviendo en la app WhatsApp Business (Coexistencia)
 * hace falta el Embedded Signup de un Tech Provider. Mientras ChronosLead no
 * lo sea, el Tech Provider es Zernio. Zernio NO entrega las credenciales de
 * Meta: devuelve el `accountId` de la cuenta en su lado, y por él enruta su
 * webhook y sale el envío. De ahí que esta forma no tenga `wabaId` ni
 * `phoneNumberId`: no existen en este transporte.
 * ------------------------------------------------------------------ */

export type ZernioWhatsapp = {
  id: string;
  organizationId: string;
  /** `accountId` de la cuenta de WhatsApp en Zernio. */
  accountRef: string;
  /** Número tal como lo muestra Zernio, solo para enseñarlo en Ajustes. */
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: "connected" | "reconnect_required";
  /** La llave de API de Zernio, descifrada. */
  token: string;
  /** Secreto HMAC con el que Zernio firma sus entregas. */
  webhookSecret: string | null;
};

function toZernio(row: Row): ZernioWhatsapp | null {
  if (row.source !== "zernio" || !row.accountRef) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    accountRef: row.accountRef,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    status: row.status,
    token: decryptSecret({
      cipher: row.tokenCipher,
      iv: row.tokenIv,
      tag: row.tokenTag,
    }),
    // Esta tabla nunca tuvo la columna en claro que arrastran las otras tres
    // (spec 030): no hay respaldo que leer, solo el cifrado.
    webhookSecret: secretoDeLaFila({ ...row, webhookSecret: null }),
  };
}

/** La conexión por Zernio de una organización, o null si no tiene. */
export async function getZernioWhatsappByOrg(
  organizationId: string
): Promise<ZernioWhatsapp | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(scoped(schema.metaCredentials.organizationId, organizationId))
    .limit(1);
  return rows[0] ? toZernio(rows[0]) : null;
}

/**
 * Resuelve la conexión por el `accountId` de Zernio: así enruta su webhook.
 * SOLO LECTURA — se llama antes de verificar la firma.
 */
export async function getZernioWhatsappByAccountRef(
  accountRef: string
): Promise<ZernioWhatsapp | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(
      and(
        eq(schema.metaCredentials.accountRef, accountRef),
        isNotNull(schema.metaCredentials.accountRef)
      )
    )
    .limit(1);
  return rows[0] ? toZernio(rows[0]) : null;
}

/**
 * Guarda (o reemplaza) la conexión de WhatsApp por Zernio de la organización.
 * Una organización tiene UNA fila de WhatsApp: conectar por Zernio sobre una
 * fila nativa la convierte, y limpia los identificadores de Meta para que no
 * quede un `phone_number_id` huérfano enrutando un webhook que ya no llega.
 */
export async function saveZernioWhatsappCredentials(input: {
  organizationId: string;
  accountRef: string;
  token: string;
  webhookSecret?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
}): Promise<void> {
  const db = getDb();
  const enc = encryptSecret(input.token);
  const comun = {
    source: "zernio" as const,
    accountRef: input.accountRef,
    wabaId: null,
    phoneNumberId: null,
    displayPhoneNumber: input.displayPhoneNumber ?? null,
    verifiedName: input.verifiedName ?? null,
    tokenCipher: enc.cipher,
    tokenIv: enc.iv,
    tokenTag: enc.tag,
    ...columnasDelSecreto(input.webhookSecret ?? null),
    status: "connected" as const,
  };
  await db
    .insert(schema.metaCredentials)
    .values({
      id: newId("credentials"),
      organizationId: input.organizationId,
      ...comun,
    })
    .onConflictDoUpdate({
      target: [schema.metaCredentials.organizationId],
      set: { ...comun, updatedAt: new Date() },
    });
}

/** El secreto de firma, guardado cifrado, sin tocar el resto de la fila. */
export async function saveZernioWhatsappWebhookSecret(
  organizationId: string,
  secret: string
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.metaCredentials)
    .set({ ...columnasDelSecreto(secret), updatedAt: new Date() })
    .where(scoped(schema.metaCredentials.organizationId, organizationId));
}

/** Últimos 4 caracteres del token para mostrar en UI (jamás el token). */
export function tokenLast4(token: string): string {
  return token.slice(-4);
}
