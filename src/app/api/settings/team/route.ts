import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getAuth, runInternalSignup } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { canConfigure } from "@/lib/auth/roles";
import { agregarAlEquipo } from "@/server/equipo/gobierno";
import { isCloud } from "@/server/tenant/edition";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const db = getDb();
  const members = await db
    .select({
      id: schema.member.id,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(scoped(schema.member.organizationId, session.organizationId));
  return Response.json({
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      name: m.name,
      email: m.email,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  /**
   * 121 — `member` atiende la Bandeja; `admin` además configura. El rol
   * `owner` NO se ofrece a propósito: es el dueño de la cuenta y se fija al
   * dar de alta. Sin este campo, un cliente que ya existe no tenía forma de
   * sumar un administrador de soporte.
   */
  rol: z.enum(["member", "admin"]).default("member"),
});

/** Alta de cuenta de equipo (owner only): email + contraseña temporal (FR-061). */
export const POST = withAuth(async (session, req: Request) => {
  if (!canConfigure(session.role)) {
    return apiError(403, "forbidden", "Hace falta ser propietario o administrador");
  }
  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  /**
   * 136 — En plataforma el alta es UNIFICADA y la gobierna la regla de rangos.
   *
   * Lo de abajo siempre llama a `signUpEmail`, así que con un correo que ya
   * tiene cuenta responde 409: un cliente con dos empresas no podía poner a su
   * empleado en la segunda. Acá, si la persona ya existe, se crea solo la
   * membresía y entra con la contraseña que ya usa.
   *
   * Sin `EDITION=cloud` sigue el camino de upstream, intacto.
   */
  if (isCloud()) {
    const r = await agregarAlEquipo(session, {
      ...body.data,
      rol: body.data.rol ?? "member",
    });
    if (!r.ok) return apiError(r.estado, r.codigo, r.mensaje);
    return Response.json(
      { ok: true, creada: r.creada, email: r.email },
      { status: 201 }
    );
  }

  const auth = getAuth();
  let newUserId: string;
  try {
    const result = await runInternalSignup(() =>
      auth.api.signUpEmail({
        body: {
          name: body.data.name,
          email: body.data.email,
          password: body.data.password,
        },
      })
    );
    newUserId = result.user.id;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo crear la cuenta";
    if (/exist/i.test(message)) {
      return apiError(409, "duplicate", "Ya existe una cuenta con ese correo");
    }
    return apiError(422, "invalid", message);
  }

  const db = getDb();
  await db
    .insert(schema.member)
    .values({
      id: newId("member"),
      organizationId: session.organizationId,
      userId: newUserId,
      role: body.data.rol,
    })
    .onConflictDoNothing();

  return Response.json({ ok: true }, { status: 201 });
});
