/**
 * 136 — Las operaciones del equipo de una organización, con la regla de rangos
 * aplicada en el servidor.
 *
 * Todo lo de aquí resuelve al objetivo con `scoped()` sobre la organización en
 * curso: un `memberId` de otro cliente sencillamente NO se encuentra, así que
 * la respuesta es la misma que para uno inventado y no se filtra su existencia.
 *
 * Fork: este módulo es nuestro. El panel de equipo de upstream solo recibe el
 * punto de entrada detrás de `EDITION=cloud`.
 */
import { and, desc, eq } from "drizzle-orm";
import { getAuth, runInternalSignup } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { crearEnlace, urlDeEnlace } from "@/server/platform/access-link";
import { baseDomain } from "@/server/tenant/edition";
import {
  puedeActuarSobre,
  puedeAsignarRol,
  puedeGobernarEquipo,
  type Rol,
} from "@/lib/auth/rangos";

export type FalloEquipo =
  | { ok: false; estado: 403; codigo: "forbidden"; mensaje: string }
  | { ok: false; estado: 404; codigo: "not_found"; mensaje: string }
  | { ok: false; estado: 409; codigo: "conflict"; mensaje: string }
  | { ok: false; estado: 422; codigo: "invalid"; mensaje: string };

export type Actor = { userId: string; organizationId: string; role: string };

const NO_ESTA: FalloEquipo = {
  ok: false,
  estado: 404,
  codigo: "not_found",
  mensaje: "Esa persona no está en este equipo",
};

/**
 * El objetivo, resuelto DENTRO de la organización en curso.
 *
 * Que un `memberId` ajeno dé el mismo 404 que uno inventado no es cosmética:
 * distinguirlos le diría a un administrador de A que cierto id existe en B.
 */
async function objetivo(organizationId: string, memberId: string) {
  const db = getDb();
  const filas = await db
    .select({
      memberId: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      email: schema.user.email,
      name: schema.user.name,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(
      scoped(
        schema.member.organizationId,
        organizationId,
        eq(schema.member.id, memberId)
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

/** Etiqueta legible de quien actúa, congelada en el momento del hecho. */
async function etiquetaDe(userId: string): Promise<string> {
  const db = getDb();
  const filas = await db
    .select({ email: schema.user.email, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const fila = filas[0];
  return fila?.email ?? fila?.name ?? userId;
}

export async function anotar(input: {
  organizationId: string;
  actorId: string | null;
  actorEtiqueta: string;
  accion: "alta" | "agregado" | "baja" | "rol" | "enlace";
  objetivoId: string | null;
  objetivoEtiqueta: string;
  detalle?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.teamAudit).values({
    id: newId("teamAudit"),
    organizationId: input.organizationId,
    actorId: input.actorId,
    actorEtiqueta: input.actorEtiqueta,
    accion: input.accion,
    objetivoId: input.objetivoId,
    objetivoEtiqueta: input.objetivoEtiqueta,
    detalle: input.detalle ?? null,
  });
}

/* ------------------------------------------------------------------ *
 * Alta unificada
 * ------------------------------------------------------------------ */

export type ResultadoAlta =
  | { ok: true; creada: true; email: string; password: string }
  | { ok: true; creada: false; email: string }
  | FalloEquipo;

/**
 * Suma a alguien al equipo. Si el correo YA tiene cuenta en la plataforma, se
 * crea solo la membresía: entra con la contraseña que ya usa.
 *
 * Antes esta ruta siempre llamaba a `signUpEmail` y respondía 409 con un correo
 * existente, así que un cliente con dos empresas no podía poner a su empleado
 * en la segunda.
 */
export async function agregarAlEquipo(
  actor: Actor,
  datos: { name: string; email: string; password: string; rol: Rol }
): Promise<ResultadoAlta> {
  if (!puedeGobernarEquipo(actor.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "Hace falta ser propietario o administrador",
    };
  }
  if (!puedeAsignarRol(actor.role, datos.rol)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés nombrar a alguien de tu mismo rango o superior",
    };
  }

  const db = getDb();
  const email = datos.email.trim().toLowerCase();
  const existentes = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  const existente = existentes[0];

  const actorEtiqueta = await etiquetaDe(actor.userId);

  if (existente) {
    const yaEs = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(
        scoped(
          schema.member.organizationId,
          actor.organizationId,
          eq(schema.member.userId, existente.id)
        )
      )
      .limit(1);
    if (yaEs[0]) {
      return {
        ok: false,
        estado: 409,
        codigo: "conflict",
        mensaje: "Esa persona ya está en el equipo",
      };
    }
    await db.insert(schema.member).values({
      id: newId("member"),
      organizationId: actor.organizationId,
      userId: existente.id,
      role: datos.rol,
    });
    await anotar({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      actorEtiqueta,
      accion: "agregado",
      objetivoId: existente.id,
      objetivoEtiqueta: email,
      detalle: `como ${datos.rol}, con su cuenta existente`,
    });
    return { ok: true, creada: false, email };
  }

  const auth = getAuth();
  let nuevoUserId: string;
  try {
    const result = await runInternalSignup(() =>
      auth.api.signUpEmail({
        body: { name: datos.name, email, password: datos.password },
      })
    );
    nuevoUserId = result.user.id;
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : "No se pudo crear la cuenta";
    return { ok: false, estado: 422, codigo: "invalid", mensaje };
  }

  await db
    .insert(schema.member)
    .values({
      id: newId("member"),
      organizationId: actor.organizationId,
      userId: nuevoUserId,
      role: datos.rol,
    })
    .onConflictDoNothing();

  await anotar({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    actorEtiqueta,
    accion: "alta",
    objetivoId: nuevoUserId,
    objetivoEtiqueta: email,
    detalle: `como ${datos.rol}, cuenta nueva`,
  });
  return { ok: true, creada: true, email, password: datos.password };
}

/* ------------------------------------------------------------------ *
 * Baja
 * ------------------------------------------------------------------ */

/**
 * Quita a alguien del equipo: borra la MEMBRESÍA, nunca la persona.
 *
 * La constitución dice que suspender retira el servicio, nunca los datos.
 * Borrar el usuario dejaría sus conversaciones huérfanas y —peor— lo sacaría de
 * las otras organizaciones donde trabaja: es el mismo usuario.
 */
export async function quitarDelEquipo(
  actor: Actor,
  memberId: string
): Promise<{ ok: true; email: string } | FalloEquipo> {
  if (!puedeGobernarEquipo(actor.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "Hace falta ser propietario o administrador",
    };
  }
  const destino = await objetivo(actor.organizationId, memberId);
  if (!destino) return NO_ESTA;

  if (destino.userId === actor.userId) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés quitarte a vos mismo",
    };
  }
  if (!puedeActuarSobre(actor.role, destino.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés quitar a alguien de tu mismo rango o superior",
    };
  }

  const db = getDb();
  await db
    .delete(schema.member)
    .where(
      scoped(
        schema.member.organizationId,
        actor.organizationId,
        eq(schema.member.id, memberId)
      )
    );
  await db
    .delete(schema.session)
    .where(eq(schema.session.userId, destino.userId));

  await anotar({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    actorEtiqueta: await etiquetaDe(actor.userId),
    accion: "baja",
    objetivoId: destino.userId,
    objetivoEtiqueta: destino.email,
    detalle: `era ${destino.role}`,
  });
  return { ok: true, email: destino.email };
}

/* ------------------------------------------------------------------ *
 * Cambio de rol
 * ------------------------------------------------------------------ */

export async function cambiarRol(
  actor: Actor,
  memberId: string,
  nuevo: Rol
): Promise<{ ok: true; email: string } | FalloEquipo> {
  if (!puedeGobernarEquipo(actor.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "Hace falta ser propietario o administrador",
    };
  }
  const destino = await objetivo(actor.organizationId, memberId);
  if (!destino) return NO_ESTA;

  if (destino.userId === actor.userId) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés cambiarte el rol a vos mismo",
    };
  }
  if (!puedeActuarSobre(actor.role, destino.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés cambiarle el rol a alguien de tu rango o superior",
    };
  }
  if (!puedeAsignarRol(actor.role, nuevo)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés nombrar a alguien de tu mismo rango o superior",
    };
  }
  if (destino.role === nuevo) {
    return { ok: true, email: destino.email };
  }

  const db = getDb();
  await db
    .update(schema.member)
    .set({ role: nuevo })
    .where(
      scoped(
        schema.member.organizationId,
        actor.organizationId,
        eq(schema.member.id, memberId)
      )
    );

  await anotar({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    actorEtiqueta: await etiquetaDe(actor.userId),
    accion: "rol",
    objetivoId: destino.userId,
    objetivoEtiqueta: destino.email,
    detalle: `${destino.role} → ${nuevo}`,
  });
  return { ok: true, email: destino.email };
}

/* ------------------------------------------------------------------ *
 * Enlace de acceso, desde el panel del cliente
 * ------------------------------------------------------------------ */

/**
 * Genera el enlace de la 106 para un miembro de rango menor.
 *
 * Es lo que saca a la plataforma del camino crítico: un operador del cliente
 * que pierde la contraseña un sábado a la noche lo destraba su propio jefe, sin
 * esperar a que nosotros abramos el panel de superadmin.
 *
 * La regla de rangos es justamente lo que impide que esto sea una escalada: un
 * administrador NO puede generar el enlace del propietario, abrirlo él mismo y
 * quedarse con la cuenta.
 */
export async function enlaceParaMiembro(
  actor: Actor,
  memberId: string
): Promise<{ ok: true; url: string; email: string } | FalloEquipo> {
  if (!puedeGobernarEquipo(actor.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "Hace falta ser propietario o administrador",
    };
  }
  const destino = await objetivo(actor.organizationId, memberId);
  if (!destino) return NO_ESTA;

  if (!puedeActuarSobre(actor.role, destino.role)) {
    return {
      ok: false,
      estado: 403,
      codigo: "forbidden",
      mensaje: "No podés generar el enlace de alguien de tu rango o superior",
    };
  }

  const db = getDb();
  const orgs = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, actor.organizationId))
    .limit(1);

  const { token } = await crearEnlace({
    organizationId: actor.organizationId,
    userId: destino.userId,
    motivo: "recuperacion",
  });
  const url = urlDeEnlace(
    orgs[0]?.slug ?? null,
    baseDomain(),
    token,
    process.env.APP_BASE_URL ?? ""
  );

  await anotar({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    actorEtiqueta: await etiquetaDe(actor.userId),
    accion: "enlace",
    objetivoId: destino.userId,
    objetivoEtiqueta: destino.email,
    detalle: "enlace de acceso generado; invalidó el anterior de esa persona",
  });
  return { ok: true, url, email: destino.email };
}

/* ------------------------------------------------------------------ *
 * Lecturas
 * ------------------------------------------------------------------ */

export async function leerBitacora(organizationId: string, limite = 50) {
  const db = getDb();
  return await db
    .select({
      id: schema.teamAudit.id,
      actorEtiqueta: schema.teamAudit.actorEtiqueta,
      accion: schema.teamAudit.accion,
      objetivoEtiqueta: schema.teamAudit.objetivoEtiqueta,
      detalle: schema.teamAudit.detalle,
      createdAt: schema.teamAudit.createdAt,
    })
    .from(schema.teamAudit)
    .where(scoped(schema.teamAudit.organizationId, organizationId))
    .orderBy(desc(schema.teamAudit.createdAt))
    .limit(limite);
}

/** A qué organizaciones pertenece una persona. Reemplaza al consentimiento. */
export async function misOrganizaciones(userId: string) {
  const db = getDb();
  return await db
    .select({
      slug: schema.organization.slug,
      nombre: schema.organization.name,
      rol: schema.member.role,
      desde: schema.member.createdAt,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.member.organizationId)
    )
    .where(and(eq(schema.member.userId, userId)))
    .orderBy(schema.organization.name);
}
