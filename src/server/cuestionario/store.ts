import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { seccionesDe, totalDe, VARIANTE_POR_DEFECTO } from "./secciones";

/**
 * 127 — El acceso a las respuestas del cuestionario.
 *
 * **No hay `scoped()` aquí, y es correcto**: esta tabla no tiene organización
 * porque el cliente todavía no existe (razón completa en `schema.ts`). Para
 * que eso no se lea como un olvido, toda consulta va por este módulo y por la
 * LLAVE, nunca por `id` suelto ni listando la tabla.
 */

export type Respuestas = Record<string, unknown>;

export type Cuestionario = {
  llave: string;
  cliente: string;
  variante: string;
  contacto: string | null;
  correo: string | null;
  seccionActual: number;
  respuestas: Respuestas;
  enviadoAt: Date | null;
};

const tabla = schema.cuestionarioRespuesta;

/** La única puerta de lectura: por la llave de la URL. */
export async function leerPorLlave(llave: string): Promise<Cuestionario | null> {
  const l = llave.trim();
  if (!l) return null;
  const filas = await getDb()
    .select({
      llave: tabla.llave,
      cliente: tabla.cliente,
      variante: tabla.variante,
      contacto: tabla.contacto,
      correo: tabla.correo,
      seccionActual: tabla.seccionActual,
      respuestas: tabla.respuestas,
      enviadoAt: tabla.enviadoAt,
    })
    .from(tabla)
    .where(eq(tabla.llave, l))
    .limit(1);
  const f = filas[0];
  if (!f) return null;
  return {
    ...f,
    respuestas: (f.respuestas ?? {}) as Respuestas,
  };
}

export type Identidad = {
  cliente: string;
  variante?: string;
  contacto?: string | null;
  correo?: string | null;
};

/**
 * Crea el cuestionario y devuelve su llave. Se llama una sola vez, en el
 * primer guardado: antes de eso el cliente no dejó nada que perder.
 */
export async function crear(identidad: Identidad): Promise<string> {
  const llave = newId("cuestionarioLlave");
  await getDb().insert(tabla).values({
    id: newId("cuestionario"),
    llave,
    cliente: identidad.cliente.trim(),
    variante: identidad.variante || VARIANTE_POR_DEFECTO,
    contacto: identidad.contacto?.trim() || null,
    correo: identidad.correo?.trim() || null,
    seccionActual: 0,
    respuestas: {},
  });
  return llave;
}

/**
 * Guarda UNA sección. Idempotente (Principio IV): el mismo guardado repetido
 * deja el mismo estado, no duplica ni pierde las otras secciones.
 *
 * La mezcla del `jsonb` se hace **en el servidor de base de datos** con `||`,
 * no leyendo y reescribiendo desde Node: así dos pestañas del mismo cliente
 * guardando secciones distintas no se pisan.
 *
 * Los nombres de columna van LITERALES dentro del `sql`. Con identificadores
 * de Drizzle interpolados ahí, este repo ya se comió una subconsulta que
 * generaba SQL mal y devolvía ceros plausibles (ver `platform/padron.ts`).
 */
export async function guardarSeccion(
  llave: string,
  variante: string,
  indiceSeccion: number,
  respuestas: Respuestas
): Promise<void> {
  const siguiente = Math.min(indiceSeccion + 1, totalDe(variante) - 1);
  await getDb()
    .update(tabla)
    .set({
      respuestas: sql`coalesce("respuestas", '{}'::jsonb) || ${JSON.stringify(respuestas)}::jsonb`,
      // Nunca retrocede: volver a una sección anterior para corregir no debe
      // hacerle perder el avance al cliente.
      seccionActual: sql`greatest("seccion_actual", ${siguiente})`,
      updatedAt: new Date(),
    })
    .where(eq(tabla.llave, llave));
}

/** Marca el cuestionario como entregado. Repetirlo no cambia la primera fecha. */
export async function marcarEnviado(llave: string): Promise<void> {
  await getDb()
    .update(tabla)
    .set({ enviadoAt: sql`coalesce("enviado_at", now())`, updatedAt: new Date() })
    .where(eq(tabla.llave, llave));
}

export type EnLaLista = {
  llave: string;
  cliente: string;
  variante: string;
  contacto: string | null;
  correo: string | null;
  seccionActual: number;
  contestadas: number;
  enviadoAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 128 — La lista para el panel del operador y para el guion.
 *
 * Trae `respuestas` entero para contar las secciones CONTESTADAS, que es más
 * honesto que `seccion_actual`: alguien puede haber avanzado dejando preguntas
 * en blanco. Con un cuestionario por cliente eso no pesa nada; si algún día
 * son cientos, el conteo se hace en SQL y no acá.
 */
export async function listar(): Promise<EnLaLista[]> {
  const filas = await getDb()
    .select({
      llave: tabla.llave,
      cliente: tabla.cliente,
      variante: tabla.variante,
      contacto: tabla.contacto,
      correo: tabla.correo,
      seccionActual: tabla.seccionActual,
      respuestas: tabla.respuestas,
      enviadoAt: tabla.enviadoAt,
      createdAt: tabla.createdAt,
      updatedAt: tabla.updatedAt,
    })
    .from(tabla)
    .orderBy(desc(tabla.updatedAt));

  return filas.map(({ respuestas, ...resto }) => ({
    ...resto,
    contestadas: seccionesContestadas(resto.variante, (respuestas ?? {}) as Respuestas),
  }));
}

/** Cuántas secciones tienen al menos una respuesta escrita. */
export function seccionesContestadas(variante: string, respuestas: Respuestas): number {
  return seccionesDe(variante).filter((s) =>
    s.bloques.some(
      (b) => b.tipo !== "nota" && hayAlgo((respuestas as Record<string, unknown>)[b.id])
    )
  ).length;
}

function hayAlgo(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(hayAlgo);
  if (typeof v === "object") return Object.values(v as object).some(hayAlgo);
  return true;
}
