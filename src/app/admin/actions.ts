"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
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
import { anotar } from "@/server/equipo/gobierno";
import {
  partirCorreos,
  primerCorreoInvalido,
  sumarSoporte,
  type ResultadoSoporte,
} from "@/server/equipo/soporte";
import { SEED_STAGES } from "@/server/auth/on-signup";
import { baseDomain } from "@/server/tenant/edition";
import { formatMoneyCents, isCurrency, parseMoneyToCents } from "@/lib/money";

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
  /**
   * 121 — El correo de soporte, opcional en el código y obligatorio en el
   * procedimiento. Entra como `admin`: configura todo, pero el dueño de la
   * cuenta sigue siendo el cliente, que puede quitarlo cuando quiera.
   */
  correoSoporte: z
    .string()
    .trim()
    .email("Ese correo de soporte no es válido: le falta el @ o lo que va después.")
    .optional()
    .or(z.literal("")),
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
    correoSoporte: String(formData.get("correoSoporte") ?? "").trim().toLowerCase(),
  });
  if (!datos.success) {
    // El primer problema, con su nombre. Listar los tres cuando falla uno hace
    // que el operador no sepa cuál tocar.
    const primero = datos.error.issues[0];
    return { error: primero?.message ?? "Revisá los datos.", aviso: null };
  }
  const { slug, nombre, correo } = datos.data;
  /**
   * 136 — VARIOS correos de soporte, no uno.
   *
   * La agencia es un equipo: con un solo campo había que sumar a los demás
   * desde adentro de cada cliente, y ahí la regla de rangos lo impide —un
   * administrador no nombra administradores—. Acá estamos por encima del
   * propietario, que es el único lugar donde corresponde hacerlo.
   */
  const correosSoporte = partirCorreos(datos.data.correoSoporte ?? "");
  const invalido = primerCorreoInvalido(correosSoporte);
  if (invalido) {
    return { error: `«${invalido}» no parece un correo.`, aviso: null };
  }
  if (correosSoporte.includes(correo)) {
    return {
      error: "El correo de soporte tiene que ser distinto del correo del dueño.",
      aviso: null,
    };
  }

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
  let soportes: ResultadoSoporte[] = [];

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

    /**
     * 121 — El operador que va a configurar esta instancia, como `admin`.
     *
     * Va en la MISMA transacción que la organización: un alta a medias —con
     * cliente y sin soporte— dejaría a alguien configurando a ciegas y no se
     * notaría hasta el primer problema.
     *
     * Si ese correo ya es usuario (lo normal: el mismo operador atiende a
     * varios clientes) se reutiliza, porque la sesión resuelve la membresía
     * contra el Host. Un solo correo sirve para todos los clientes.
     */
    /**
     * 121 · 136 — El equipo que va a configurar esta instancia, como `admin`.
     *
     * Va en la MISMA transacción que la organización: un alta a medias —con
     * cliente y sin soporte— dejaría a alguien configurando a ciegas y no se
     * notaría hasta el primer problema.
     *
     * Los correos que YA son usuarios se reutilizan (lo normal: el mismo
     * equipo atiende a varios clientes); un solo correo sirve para todos,
     * porque la sesión resuelve la membresía contra el Host.
     */
    soportes = await sumarSoporte(tx, orgId, correosSoporte);

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

  /**
   * 136 — El enlace del dueño, SOLO si la cuenta se creó nueva.
   *
   * Se generaba siempre, sin la guarda que la 133 le puso al de soporte. Con un
   * dueño que ya era usuario —un cliente con varias empresas: Fernando Barreto
   * es propietario de seis— cada alta le dejaba vivo un enlace de un solo uso
   * capaz de FIJARLE la contraseña. Y como es el mismo usuario en todas, quien
   * lo tuviera entraba a todas sus organizaciones, no solo a la nueva. Encima
   * el panel decía «mandale este enlace al dueño», que es el peor consejo
   * posible: no lo necesita y mandarlo es repartir esa llave.
   *
   * No hace falta: entra en la dirección nueva con la contraseña de siempre.
   * Si alguna vez la pierde, se le genera uno desde el panel, a propósito.
   */
  const enlace = usuario[0]
    ? null
    : urlDeEnlace(
        slug,
        baseDomain(),
        (await crearEnlace({ organizationId: orgId, userId, motivo: "alta" })).token,
        process.env.APP_BASE_URL ?? ""
      );

  /**
   * 133 · 136 — Un enlace por cada cuenta de soporte que se creó NUEVA.
   *
   * El alta las creaba con `password: null` y sin enlace: quedaba una cuenta
   * sin contraseña y sin forma de ponerle una. El operador se enteraba al
   * intentar entrar y que lo devolviera al login sin decir nada. Pasó en el
   * alta de The Student Store, el primer cliente real.
   *
   * A quien YA era usuario no se le genera ninguno: tiene su contraseña, y un
   * enlace nuevo le invalidaría el que pudiera estar usando en otro cliente.
   */
  const enlacesSoporte: string[] = [];
  for (const sop of soportes) {
    if (!sop.nuevo) continue;
    const { token: tokenSop } = await crearEnlace({
      organizationId: orgId,
      userId: sop.userId,
      motivo: "alta",
    });
    enlacesSoporte.push(
      `SOPORTE (${sop.correo}): ${urlDeEnlace(slug, baseDomain(), tokenSop, process.env.APP_BASE_URL ?? "")}`
    );
  }

  registrar(guardia.autor, "alta", orgId, slug);
  revalidatePath("/admin");
  // Los dos enlaces en el mismo aviso: el de soporte es para el operador y no
  // se le manda al cliente. Van separados por una línea para que no se
  // confundan al copiar.
  const avisoDueno =
    enlace ??
    `YA TIENE CUENTA (${correo}): entra en ${slug}.${baseDomain()} con su contraseña de siempre. No hay enlace que mandar.`;
  const yaTenian = soportes
    .filter((x) => !x.nuevo)
    .map((x) => x.correo);
  const notaSoporte =
    yaTenian.length > 0
      ? `\n\nSOPORTE que YA tenía cuenta (entra con la de siempre): ${yaTenian.join(", ")}`
      : "";
  return {
    error: null,
    aviso: [avisoDueno, ...enlacesSoporte].join("\n\n") + notaSoporte,
  };
}

const idSchema = z.object({ organizationId: z.string().trim().min(1) });

/**
 * 109 — Registrar un cobro. Guarda el hecho (para el extracto) y mueve la
 * fecha de «pagado hasta» (para el acceso), en una transacción.
 */
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

  const importeCentavos = parseMoneyToCents(String(formData.get("importe") ?? ""));
  if (importeCentavos === null || importeCentavos <= 0) {
    return {
      error: "Escribí cuánto cobraste (por ejemplo 1500 o 1.500,00).",
      aviso: null,
    };
  }

  const moneda = String(formData.get("moneda") ?? "").trim().toUpperCase();
  if (!isCurrency(moneda)) {
    return { error: "Elegí la moneda del cobro.", aviso: null };
  }

  const periodo = await registrarPago(datos.data.organizationId, {
    hasta,
    importeCentavos,
    moneda,
    nota: String(formData.get("nota") ?? ""),
    registradoPor: guardia.autor,
  });

  registrar(
    guardia.autor,
    "pago",
    datos.data.organizationId,
    `${formatMoneyCents(importeCentavos, moneda)} · hasta ${periodo.hasta.toISOString().slice(0, 10)}`
  );
  revalidatePath("/admin");
  return {
    error: null,
    aviso: `Cobro de ${formatMoneyCents(importeCentavos, moneda)} registrado. Cubre hasta el ${periodo.hasta.toLocaleDateString("es")}.`,
  };
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

/**
 * Genera un enlace de acceso para UN miembro concreto de una organización (106).
 *
 * 136 — A quién, elegido por nombre.
 *
 * Antes recibía `para=dueno|soporte`, filtraba por rol y hacía `.limit(1)` SIN
 * `ORDER BY`: con dos administradores devolvía uno indeterminado. Y como crear
 * un enlace invalida el anterior de esa persona, se le podía romper el acceso a
 * un compañero creyendo que uno se lo generaba a sí mismo. Además, los miembros
 * de Bandeja no tenían forma de recibir uno: el filtro solo contemplaba `owner`
 * y `admin`, y sin correo transaccional ese panel es la única mesa de
 * recuperación que existe.
 *
 * Superadmin no tiene límite de rango —es la autoridad de última instancia, y
 * el bloqueo del propietario solo se puede destrabar desde acá—, pero el hecho
 * queda en la bitácora que el cliente ve.
 */
export async function enlaceDeAcceso(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = idSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!datos.success) return { error: "Cliente no indicado.", aviso: null };

  const memberId = String(formData.get("memberId") ?? "").trim();
  if (!memberId) {
    return { error: "Elegí a quién se lo generás.", aviso: null };
  }

  const db = getDb();
  const filas = await db
    .select({
      userId: schema.member.userId,
      rol: schema.member.role,
      correo: schema.user.email,
      slug: schema.organization.slug,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.member.organizationId)
    )
    .where(
      and(
        eq(schema.member.organizationId, datos.data.organizationId),
        eq(schema.member.id, memberId)
      )
    )
    .limit(1);
  const fila = filas[0];
  if (!fila) {
    return { error: "Esa persona no está en este cliente.", aviso: null };
  }

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

  registrar(guardia.autor, `enlace de acceso (${fila.correo})`, datos.data.organizationId);
  await anotar({
    organizationId: datos.data.organizationId,
    actorId: null,
    actorEtiqueta: guardia.autor,
    accion: "enlace",
    objetivoId: fila.userId,
    objetivoEtiqueta: fila.correo,
    detalle:
      "generado desde el panel de plataforma; invalidó el anterior de esa persona",
  });
  return { error: null, aviso: enlace };
}


/**
 * 136 — Sumar soporte de la agencia a un cliente QUE YA EXISTE.
 *
 * Sin esto, el único camino era pedirle al propietario que los agregara él
 * desde Ajustes → Equipo: la regla de rangos impide que un administrador
 * nombre administradores, y con razón —si pudiera, la esquivaría fabricándose
 * un par—. Hacerle hacer eso al cliente es pedirle que administre nuestro
 * equipo.
 *
 * Superadmin está por encima del propietario, así que acá sí corresponde. El
 * hecho queda en la bitácora que el cliente ve en su propio panel: tiene que
 * poder enterarse de quién entró a su cuenta, sobre todo sin correo con que
 * avisarle.
 */
export async function sumarSoporteACliente(
  _prev: ResultadoAccion,
  formData: FormData
): Promise<ResultadoAccion> {
  const guardia = await exigirSuperadmin();
  if (!guardia.ok) return guardia.resultado;

  const datos = idSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!datos.success) return { error: "Cliente no indicado.", aviso: null };

  const correos = partirCorreos(String(formData.get("correos") ?? ""));
  if (correos.length === 0) {
    return { error: "Escribí al menos un correo.", aviso: null };
  }
  const invalido = primerCorreoInvalido(correos);
  if (invalido) return { error: `«${invalido}» no parece un correo.`, aviso: null };

  const db = getDb();
  const orgs = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, datos.data.organizationId))
    .limit(1);
  const org = orgs[0];
  if (!org) return { error: "Ese cliente no existe.", aviso: null };

  /**
   * El propietario NO se toca: si uno de estos correos es el dueño, sumarlo
   * como `admin` le agregaría una segunda membresía y lo degradaría de hecho.
   */
  const duenos = await db
    .select({ email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(
      and(
        eq(schema.member.organizationId, datos.data.organizationId),
        eq(schema.member.role, "owner")
      )
    );
  const choque = correos.find((c) => duenos.some((d) => d.email === c));
  if (choque) {
    return {
      error: `«${choque}» es el propietario de este cliente. No se suma como soporte.`,
      aviso: null,
    };
  }

  const resultados = await db.transaction((tx) =>
    sumarSoporte(tx, datos.data.organizationId, correos)
  );

  const lineas: string[] = [];
  for (const sop of resultados) {
    if (sop.yaEstaba) {
      lineas.push(`${sop.correo}: ya estaba en este cliente. Sin cambios.`);
      continue;
    }
    if (!sop.nuevo) {
      lineas.push(
        `${sop.correo}: agregado. Entra en ${org.slug}.${baseDomain()} con su contraseña de siempre.`
      );
    } else {
      const { token } = await crearEnlace({
        organizationId: datos.data.organizationId,
        userId: sop.userId,
        motivo: "alta",
      });
      lineas.push(
        `${sop.correo}: cuenta nueva. ${urlDeEnlace(org.slug, baseDomain(), token, process.env.APP_BASE_URL ?? "")}`
      );
    }
    await anotar({
      organizationId: datos.data.organizationId,
      actorId: null,
      actorEtiqueta: guardia.autor,
      accion: "agregado",
      objetivoId: sop.userId,
      objetivoEtiqueta: sop.correo,
      detalle: "soporte de la agencia, como administrador, desde el panel de plataforma",
    });
  }

  registrar(
    guardia.autor,
    `soporte sumado (${correos.join(", ")})`,
    datos.data.organizationId
  );
  revalidatePath("/admin");
  return { error: null, aviso: lineas.join("\n") };
}
