import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
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
  /** 109 — Los últimos cobros, para verlos sin salir del panel. */
  pagos: PagoDelHistorico[];
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

  // Todos los pagos de una vez: una consulta por cliente dentro de un bucle es
  // el camino más corto a un panel que tarda con veinte clientes.
  const pagos = await db
    .select({
      id: schema.payment.id,
      organizationId: schema.payment.organizationId,
      cobradoEn: schema.payment.cobradoEn,
      cubreDesde: schema.payment.cubreDesde,
      cubreHasta: schema.payment.cubreHasta,
      importeCentavos: schema.payment.importeCentavos,
      moneda: schema.payment.moneda,
      nota: schema.payment.nota,
      registradoPor: schema.payment.registradoPor,
    })
    .from(schema.payment)
    .orderBy(desc(schema.payment.cobradoEn));

  const porOrganizacion = new Map<string, PagoDelHistorico[]>();
  for (const p of pagos) {
    const { organizationId, ...resto } = p;
    const lista = porOrganizacion.get(organizationId) ?? [];
    lista.push(resto);
    porOrganizacion.set(organizationId, lista);
  }

  const ahora = new Date();
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    altaEn: f.altaEn,
    usuarios: f.usuarios,
    pagadoHasta: f.paidThrough,
    pagos: porOrganizacion.get(f.id) ?? [],
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

export type DatosDelPago = {
  /** Hasta cuándo cubre. Sin fecha, un mes desde donde terminaba el anterior. */
  hasta?: Date;
  importeCentavos: number;
  moneda: string;
  nota?: string;
  registradoPor: string;
};

/**
 * 109 — Registra un pago: guarda el HECHO y mueve el ESTADO, en una
 * transacción.
 *
 * Las dos cosas juntas o ninguna. Si se guardara el pago sin mover la fecha, el
 * cliente seguiría suspendido con el dinero cobrado; si se moviera la fecha sin
 * guardar el pago, el extracto mentiría.
 *
 * El periodo arranca donde terminaba el anterior, no hoy: un cliente que paga
 * con tres días de retraso no pierde esos tres días. Si venía sin fecha o ya
 * vencida hace mucho, arranca hoy.
 */
export async function registrarPago(
  organizationId: string,
  datos: DatosDelPago
): Promise<{ desde: Date; hasta: Date }> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    const filas = await tx
      .select({ paidThrough: schema.organization.paidThrough })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1);

    const hoy = new Date();
    const anterior = filas[0]?.paidThrough ?? null;
    const desde = anterior && anterior.getTime() > hoy.getTime() ? anterior : hoy;
    const hasta = datos.hasta ?? unMesDespuesDe(desde);

    await tx.insert(schema.payment).values({
      id: newId("payment"),
      organizationId,
      cobradoEn: hoy,
      cubreDesde: desde,
      cubreHasta: hasta,
      importeCentavos: datos.importeCentavos,
      moneda: datos.moneda,
      nota: datos.nota?.trim() || null,
      registradoPor: datos.registradoPor,
    });

    await tx
      .update(schema.organization)
      .set({ paidThrough: hasta })
      .where(eq(schema.organization.id, organizationId));

    return { desde, hasta };
  });
}

function unMesDespuesDe(d: Date): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + 1);
  return r;
}

export type PagoDelHistorico = {
  id: string;
  cobradoEn: Date;
  cubreDesde: Date;
  cubreHasta: Date;
  importeCentavos: number;
  moneda: string;
  nota: string | null;
  registradoPor: string;
};

/** El histórico de un cliente, del más reciente al más viejo. */
export async function historicoDePagos(
  organizationId: string
): Promise<PagoDelHistorico[]> {
  return await getDb()
    .select({
      id: schema.payment.id,
      cobradoEn: schema.payment.cobradoEn,
      cubreDesde: schema.payment.cubreDesde,
      cubreHasta: schema.payment.cubreHasta,
      importeCentavos: schema.payment.importeCentavos,
      moneda: schema.payment.moneda,
      nota: schema.payment.nota,
      registradoPor: schema.payment.registradoPor,
    })
    .from(schema.payment)
    .where(eq(schema.payment.organizationId, organizationId))
    .orderBy(desc(schema.payment.cobradoEn));
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
