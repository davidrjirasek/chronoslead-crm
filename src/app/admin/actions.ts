"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { resolveTenantFromHost } from "@/lib/tenant/host";
import { crearEnlace, urlDeEnlace } from "@/server/platform/access-link";
import {
  levantarSuspension,
  registrar,
  registrarPago,
  suspender,
} from "@/server/platform/padron";
import { accesoAlPanel } from "@/server/platform/superadmin";
import { SEED_STAGES } from "@/server/auth/on-signup";
import { baseDomain } from "@/server/tenant/edition";

export type ResultadoAccion = { error: string | null; aviso: string | null };

const VACIO: ResultadoAccion = { error: null, aviso: null };

/**
 * 108 — Toda acción del panel vuelve a comprobar quién la pide.
 *
 * Una acción de servidor es una superficie pública: se puede invocar sin pasar
 * por la pantalla. Confiar en que el panel ya comprobó el permiso es confiar en
 * el cliente, que es como se abren las puertas que uno creía cerradas.
 */
async function exigirSuperadmin(): Promise<
  { ok: true; autor: string } | { ok: false; resultado: ResultadoAccion }
> {
  const acceso = await accesoAlPanel();
  if (!acceso.ok) {
    return {
      ok: false,
      resultado: { error: "No autorizado.", aviso: null },
    };
  }
  return { ok: true, autor: acceso.sesion.correo };
}

/**
 * 108 — Cada campo con su mensaje.
 *
 * La primera versión devolvía «Revisá el nombre, el identificador y el correo»
 * para cualquier fallo, y el operador tenía que adivinar cuál de los tres. Un
 * error que no dice qué arreglar obliga a probar a ciegas.
 */
const altaSchema = z.object({
  slug: z.string().trim().min(1, "Falta el identificador."),
  nombre: z
    .string()
    .trim()
    .min(1, "Falta el nombre del negocio.")
    .max(120, "El nombre no puede pasar de 120 caracteres."),
  correo: z
    .string()
    .trim()
    .min(1, "Falta el correo del dueño.")
    .email("Ese correo no es válido: le falta el @ o lo que va después (por ejemplo dueno@sonrisa.com)."),
});

/**
 * Da de alta un cliente. Hace lo mismo que `pnpm provision` y por las mismas
 * razones: valida el slug con la función que resuelve el Host —si aquí pasara
 * uno que allí no resuelve, el cliente tendría una organización a la que nadie
 * puede entrar— y es idempotente.
 */
export async function altaDeCliente(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = altaSchema.safeParse({
    slug: String(formData.get("slug") ?? "").toLowerCase(),
    nombre: formData.get("nombre"),
    correo: String(formData.get("correo") ?? "").toLowerCase(),
  });
  if (!datos.success) {
    // El primer problema, con su nombre. Listar los tres cuando falla uno hace
    // que el operador no sepa cuál tocar.
    const primero = datos.error.issues[0];
    return { error: primero?.message ?? "Revisá los datos.", aviso: null };
  }
  const { slug, nombre, correo } = datos.data;

  if (resolveTenantFromHost(`${slug}.ejemplo.test`, "ejemplo.test").kind !== "tenant") {
    return {
      error:
        "El identificador debe tener de 3 a 30 caracteres (minúsculas, números y guiones), " +
        "sin guion al principio ni al final, y no puede ser una palabra reservada.",
      aviso: null,
    };
  }

  const db = getDb();
  const existe = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1);
  if (existe[0]) {
    return { error: `Ya existe un cliente con el identificador "${slug}".`, aviso: null };
  }

  const usuario = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, correo))
    .limit(1);

  const orgId = newId("organization");
  const userId = usuario[0]?.id ?? `usr_${newId("member").slice(4)}`;

  await db.transaction(async (tx) => {
    await tx.insert(schema.organization).values({ id: orgId, name: nombre, slug });
    if (!usuario[0]) {
      await tx.insert(schema.user).values({
        id: userId,
        name: nombre,
        email: correo,
        emailVerified: false,
      });
      // Sin contraseña: la elige el dueño con el enlace (106).
      await tx.insert(schema.account).values({
        id: `acc_${newId("member").slice(4)}`,
        accountId: userId,
        providerId: "credential",
        userId,
        password: null,
      });
    }
    await tx.insert(schema.member).values({
      id: newId("member"),
      organizationId: orgId,
      userId,
      role: "owner",
    });
    await tx.insert(schema.pipelineStage).values(
      SEED_STAGES.map((s, i) => ({
        id: newId("stage"),
        organizationId: orgId,
        name: s.name,
        position: i,
        kind: s.kind,
      }))
    );
    await tx.insert(schema.agentProfile).values({
      id: newId("agentProfile"),
      organizationId: orgId,
    });
  });

  const { token } = await crearEnlace({ organizationId: orgId, userId, motivo: "alta" });
  const enlace = urlDeEnlace(slug, baseDomain(), token, process.env.APP_BASE_URL ?? "");

  registrar(guardia.autor, "alta", orgId, slug);
  revalidatePath("/admin");
  return { error: null, aviso: enlace };
}

const idSchema = z.object({ organizationId: z.string().trim().min(1) });

export async function marcarPago(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = idSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!datos.success) return { error: "Cliente no indicado.", aviso: null };

  const hastaTexto = String(formData.get("hasta") ?? "").trim();
  const hasta = hastaTexto ? new Date(`${hastaTexto}T12:00:00Z`) : undefined;
  if (hasta && Number.isNaN(hasta.getTime())) {
    return { error: "La fecha no es válida.", aviso: null };
  }

  await registrarPago(datos.data.organizationId, hasta);
  registrar(guardia.autor, "pago", datos.data.organizationId, hastaTexto || "+1 mes");
  revalidatePath("/admin");
  return VACIO;
}

export async function suspenderCliente(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = idSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!datos.success) return { error: "Cliente no indicado.", aviso: null };

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) {
    return { error: "Escribí el motivo: sin él, nadie sabrá por qué se cortó.", aviso: null };
  }

  await suspender(datos.data.organizationId, motivo);
  registrar(guardia.autor, "suspensión", datos.data.organizationId, motivo);
  revalidatePath("/admin");
  return VACIO;
}

export async function reactivarCliente(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = idSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!datos.success) return { error: "Cliente no indicado.", aviso: null };

  await levantarSuspension(datos.data.organizationId);
  registrar(guardia.autor, "reactivación", datos.data.organizationId);
  revalidatePath("/admin");
  return VACIO;
}

/** Genera un enlace de acceso para el dueño de una organización (106). */
export async function enlaceDeAcceso(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = idSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!datos.success) return { error: "Cliente no indicado.", aviso: null };

  const db = getDb();
  const filas = await db
    .select({
      userId: schema.member.userId,
      slug: schema.organization.slug,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.member.organizationId)
    )
    .where(eq(schema.member.organizationId, datos.data.organizationId))
    .limit(1);
  const fila = filas[0];
  if (!fila) return { error: "Ese cliente no tiene todavía ningún usuario.", aviso: null };

  const { token } = await crearEnlace({
    organizationId: datos.data.organizationId,
    userId: fila.userId,
    motivo: "recuperacion",
  });
  const enlace = urlDeEnlace(
    fila.slug,
    baseDomain(),
    token,
    process.env.APP_BASE_URL ?? ""
  );

  registrar(guardia.autor, "enlace de acceso", datos.data.organizationId);
  return { error: null, aviso: enlace };
}
