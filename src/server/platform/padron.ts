import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  estadoDeOrganizacion,
  type EstadoOrganizacion,
} from "@/lib/tenant/estado";

/**
 * 108 — La cartera de clientes.
 *
 * Lo que muestra sale de columnas que ya existen desde la 104; el panel es una
 * cara para eso, no una vía nueva de leer ni de escribir.
 *
 * NO devuelve contactos, mensajes ni citas: el superadmin administra la
 * cartera, no lee las conversaciones de los clientes de nadie.
 */
export type FilaDelPadron = {
  id: string;
  nombre: string;
  slug: string | null;
  altaEn: Date;
  usuarios: number;
  pagadoHasta: Date | null;
  estado: EstadoOrganizacion;
};

export async function listarPadron(): Promise<FilaDelPadron[]> {
  const db = getDb();
  const filas = await db
    .select({
      id: schema.organization.id,
      nombre: schema.organization.name,
      slug: schema.organization.slug,
      altaEn: schema.organization.createdAt,
      paidThrough: schema.organization.paidThrough,
      suspendedAt: schema.organization.suspendedAt,
      suspendedReason: schema.organization.suspendedReason,
      /*
       * Con los identificadores de Drizzle interpolados aquí dentro, la
       * subconsulta se generaba mal y devolvía 0 para TODOS los clientes —un
       * cero plausible, que es la peor clase de dato equivocado—. Con los
       * nombres literales de las columnas se genera el SQL que se pretendía.
       */
      usuarios: sql<number>`(
        select count(*) from "member" m
        where m."organization_id" = "organization"."id"
      )`.mapWith(Number),
    })
    .from(schema.organization)
    .orderBy(asc(schema.organization.createdAt));

  const ahora = new Date();
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    altaEn: f.altaEn,
    usuarios: f.usuarios,
    pagadoHasta: f.paidThrough,
    estado: estadoDeOrganizacion(
      {
        paidThrough: f.paidThrough,
        suspendedAt: f.suspendedAt,
        suspendedReason: f.suspendedReason,
      },
      ahora
    ),
  }));
}

/**
 * Mueve la fecha de «pagado hasta». Sin fecha, un mes desde hoy — que es lo que
 * se hace el 99% de las veces y no debería costar un calendario.
 */
export async function registrarPago(
  organizationId: string,
  hasta?: Date
): Promise<void> {
  const nueva = hasta ?? unMesDesdeHoy();
  await getDb()
    .update(schema.organization)
    .set({ paidThrough: nueva })
    .where(eq(schema.organization.id, organizationId));
}

function unMesDesdeHoy(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Suspensión MANUAL. Pagar no la levanta: la quita quien la puso. Es una causa
 * distinta del impago y se resuelve por separado (104).
 */
export async function suspender(
  organizationId: string,
  motivo: string
): Promise<void> {
  await getDb()
    .update(schema.organization)
    .set({ suspendedAt: new Date(), suspendedReason: motivo.trim() || null })
    .where(eq(schema.organization.id, organizationId));
}

export async function levantarSuspension(organizationId: string): Promise<void> {
  await getDb()
    .update(schema.organization)
    .set({ suspendedAt: null, suspendedReason: null })
    .where(eq(schema.organization.id, organizationId));
}

/**
 * El registro de lo que hace el superadmin.
 *
 * Al log del servidor y no a una tabla: es lo que Coolify ya recoge y conserva,
 * y una tabla de auditoría que nadie consulta es trabajo sin lector. Si algún
 * día hace falta consultarla desde el panel, entonces sí merece su tabla.
 *
 * Sin datos de clientes: quién, qué, sobre qué organización y cuándo.
 */
export function registrar(
  autor: string,
  accion: string,
  organizationId: string,
  detalle?: string
): void {
  console.info(
    `[plataforma] ${new Date().toISOString()} · ${autor} · ${accion} · ${organizationId}` +
      (detalle ? ` · ${detalle}` : "")
  );
}
