/**
 * 136 — El equipo de soporte de la agencia dentro de un cliente.
 *
 * El alta aceptaba UN correo de soporte. Con una agencia de cuatro personas
 * eso obligaba a sumar a los otros tres desde adentro de cada cliente, y ahí
 * choca con la regla de rangos: un administrador NO puede nombrar
 * administradores —si pudiera, la esquivaría fabricándose un par—. El único
 * camino legítimo está por encima del propietario, o sea superadmin.
 *
 * Por eso esto lo usan los dos lados: el alta de un cliente nuevo y la acción
 * para sumar soporte a uno que ya existe (el caso de The Student Store, creada
 * antes de que esto existiera).
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";

/** La transacción de Drizzle. Las dos entradas pasan por una: el alta a medias
 *  —cliente sin su soporte— deja a alguien configurando a ciegas. */
export type Tx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export type ResultadoSoporte = {
  correo: string;
  userId: string;
  /** Cuenta recién creada: necesita su enlace para elegir contraseña (106). */
  nuevo: boolean;
  /** Ya era miembro de ESTA organización: no se duplica ni se le cambia el rol. */
  yaEstaba: boolean;
};

/**
 * Parte el campo del formulario en correos.
 *
 * Acepta coma, punto y coma, espacios y saltos de línea: el operador pega la
 * lista de donde la tenga y no se pelea con el formato.
 */
export function partirCorreos(crudo: string): string[] {
  return [
    ...new Set(
      crudo
        .split(/[\s,;]+/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** El primero que esté mal, con su nombre. Listar todos no ayuda a corregir. */
export function primerCorreoInvalido(correos: string[]): string | null {
  return correos.find((c) => !CORREO.test(c)) ?? null;
}

/**
 * Suma cada correo como `admin` de esa organización.
 *
 * - Si la persona ya es usuario, se REUTILIZA: un solo correo sirve para todos
 *   los clientes, porque la sesión resuelve la membresía contra el Host.
 *   Crearle otra cuenta le multiplicaría contraseñas.
 * - Si ya es miembro de esa organización, no se toca: ni se duplica la fila ni
 *   se le pisa el rol. La tabla `member` no tiene índice único sobre
 *   (organización, usuario), así que la comprobación va explícita.
 * - Si es nueva, se crea SIN contraseña: la elige con su enlace (106).
 */
export async function sumarSoporte(
  tx: Tx,
  organizationId: string,
  correos: string[]
): Promise<ResultadoSoporte[]> {
  if (correos.length === 0) return [];

  const existentes = await tx
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(inArray(schema.user.email, correos));
  const idPorCorreo = new Map(existentes.map((u) => [u.email, u.id]));

  const ids = [...idPorCorreo.values()];
  const miembrosDeEsta =
    ids.length > 0
      ? await tx
          .select({ userId: schema.member.userId })
          .from(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, organizationId),
              inArray(schema.member.userId, ids)
            )
          )
      : [];
  const yaEnEsta = new Set(miembrosDeEsta.map((m) => m.userId));

  const salida: ResultadoSoporte[] = [];

  for (const correo of correos) {
    const existente = idPorCorreo.get(correo);
    const userId = existente ?? `usr_${newId("member").slice(4)}`;

    if (!existente) {
      await tx.insert(schema.user).values({
        id: userId,
        name: correo,
        email: correo,
        emailVerified: false,
      });
      await tx.insert(schema.account).values({
        id: `acc_${newId("member").slice(4)}`,
        accountId: userId,
        providerId: "credential",
        userId,
        password: null,
      });
    }

    const yaEstaba = existente ? yaEnEsta.has(existente) : false;
    if (!yaEstaba) {
      await tx.insert(schema.member).values({
        id: newId("member"),
        organizationId,
        userId,
        role: "admin",
      });
    }

    salida.push({ correo, userId, nuevo: !existente, yaEstaba });
  }

  return salida;
}
