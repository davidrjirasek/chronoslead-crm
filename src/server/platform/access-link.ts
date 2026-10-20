import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { estadoDeOrganizacion, puedeEntrar } from "@/lib/tenant/estado";

/**
 * 106 — Enlaces de un solo uso para fijar una contraseña.
 *
 * El alta y el «olvidé mi contraseña» son la misma pieza. En la base vive el
 * HASH del token: quien la lea no puede usar los enlaces. El token en claro
 * existe solo mientras se genera y viaja en la URL que el operador entrega.
 */

export const DIAS_DE_VALIDEZ = 7;
export const MIN_LONGITUD_CONTRASENA = 8;

export type MotivoEnlace = "alta" | "recuperacion";

function hashDe(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/**
 * Crea el enlace e **invalida el anterior de esa persona y motivo**. Sin eso,
 * un enlace que el operador creyó reemplazado seguiría abriendo la cuenta.
 *
 * Devuelve el token en claro UNA vez: no se puede volver a obtener.
 */
export async function crearEnlace(input: {
  organizationId: string;
  userId: string;
  motivo: MotivoEnlace;
}): Promise<{ token: string; expiraEn: Date }> {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DIAS_DE_VALIDEZ * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.accessLink)
      .where(
        and(
          eq(schema.accessLink.userId, input.userId),
          eq(schema.accessLink.motivo, input.motivo)
        )
      );
    await tx.insert(schema.accessLink).values({
      id: newId("accessLink"),
      organizationId: input.organizationId,
      userId: input.userId,
      tokenHash: hashDe(token),
      motivo: input.motivo,
      expiresAt: expiraEn,
    });
  });

  return { token, expiraEn };
}

export type EnlaceValido = {
  id: string;
  organizationId: string;
  userId: string;
  motivo: MotivoEnlace;
  nombreOrganizacion: string;
};

/**
 * `null` para TODO lo que no sirva: inventado, caducado, ya usado, de otra
 * organización o de una organización suspendida. Quien lo consuma no puede
 * distinguir cuál era el caso, y así un enlace inventado no revela si existe.
 */
export async function validarEnlace(
  token: string,
  organizationIdDelHost: string
): Promise<EnlaceValido | null> {
  if (!token) return null;
  const db = getDb();

  const filas = await db
    .select({
      id: schema.accessLink.id,
      organizationId: schema.accessLink.organizationId,
      userId: schema.accessLink.userId,
      motivo: schema.accessLink.motivo,
      expiresAt: schema.accessLink.expiresAt,
      nombreOrganizacion: schema.organization.name,
      paidThrough: schema.organization.paidThrough,
      suspendedAt: schema.organization.suspendedAt,
      suspendedReason: schema.organization.suspendedReason,
    })
    .from(schema.accessLink)
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.accessLink.organizationId)
    )
    .where(
      and(
        eq(schema.accessLink.tokenHash, hashDe(token)),
        isNull(schema.accessLink.usedAt)
      )
    )
    .limit(1);

  const fila = filas[0];
  if (!fila) return null;
  if (fila.expiresAt.getTime() <= Date.now()) return null;
  // Un enlace de A abierto en el subdominio de B no vale.
  if (fila.organizationId !== organizationIdDelHost) return null;
  // Suspendida: no hay a qué entrar.
  if (!puedeEntrar(estadoDeOrganizacion(fila, new Date()))) return null;

  return {
    id: fila.id,
    organizationId: fila.organizationId,
    userId: fila.userId,
    motivo: fila.motivo,
    nombreOrganizacion: fila.nombreOrganizacion,
  };
}

export type ResultadoConsumo =
  | { ok: true; userId: string }
  | { ok: false; codigo: "enlace_invalido" | "contrasena_corta" };

/**
 * Fija la contraseña, marca el enlace como usado y **cierra las sesiones
 * abiertas** de esa persona: si alguien había entrado con la anterior, deja de
 * estar dentro. Es lo que hace que la recuperación sirva de verdad cuando se
 * sospecha de un acceso ajeno.
 *
 * El marcado del enlace va en la misma transacción y condicionado a que siga
 * sin usar: dos peticiones a la vez no pueden consumirlo las dos.
 */
export async function consumirEnlace(
  token: string,
  organizationIdDelHost: string,
  contrasena: string
): Promise<ResultadoConsumo> {
  if (contrasena.length < MIN_LONGITUD_CONTRASENA) {
    return { ok: false, codigo: "contrasena_corta" };
  }

  const enlace = await validarEnlace(token, organizationIdDelHost);
  if (!enlace) return { ok: false, codigo: "enlace_invalido" };

  const hash = await hashPassword(contrasena);
  const db = getDb();

  let consumido = false;
  await db.transaction(async (tx) => {
    const marcado = await tx
      .update(schema.accessLink)
      .set({ usedAt: new Date() })
      .where(
        and(eq(schema.accessLink.id, enlace.id), isNull(schema.accessLink.usedAt))
      )
      .returning({ id: schema.accessLink.id });
    if (marcado.length === 0) return;

    await tx
      .update(schema.account)
      .set({ password: hash, updatedAt: new Date() })
      .where(
        and(
          eq(schema.account.userId, enlace.userId),
          eq(schema.account.providerId, "credential")
        )
      );
    await tx.delete(schema.session).where(eq(schema.session.userId, enlace.userId));
    consumido = true;
  });

  return consumido
    ? { ok: true, userId: enlace.userId }
    : { ok: false, codigo: "enlace_invalido" };
}

/**
 * La URL que el operador entrega. El token viaja aquí y en ningún otro sitio.
 *
 * El protocolo y el puerto salen de `APP_BASE_URL`: en producción no hay
 * puerto, pero en local la app vive en :3000 y sin él el enlace no abre nada.
 */
export function urlDeEnlace(
  slug: string | null,
  baseDomain: string,
  token: string,
  appBaseUrl: string
): string {
  let protocolo = "https";
  let puerto = "";
  try {
    const base = new URL(appBaseUrl);
    protocolo = base.protocol.replace(":", "");
    puerto = base.port ? `:${base.port}` : "";
  } catch {
    // Sin APP_BASE_URL utilizable, https y sin puerto: lo correcto en producción.
  }
  const host = slug && baseDomain ? `${slug}.${baseDomain}` : baseDomain;
  return `${protocolo}://${host}${puerto}/activar/${token}`;
}
