import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  normalizeWeeklyHours,
  type WeeklyHours,
} from "@/server/agenda/settings";

/**
 * 146 — Quién atiende. La agenda deja de ser una sola por organización.
 *
 * El caso que lo pidió: Colegio Cerritos tiene dos directores de admisiones y
 * el grado del alumno decide cuál. Con una agenda única, que Mariel ocupe el
 * martes a las 10:00 dejaba ocupado también a Rodrigo, que estaba libre: la
 * mitad del cupo de la semana desaparecía.
 *
 * **Apagado, esto no existe.** El interruptor es por ORGANIZACIÓN
 * (`organization.agenda_resources`), no una variable de entorno: una sola
 * instancia sirve a los nueve clientes, y lo que prende por entorno prende
 * para todos. Un cliente sin el interruptor no ve una pantalla nueva, su
 * agente no gasta un token en recursos y su agenda se comporta byte por byte
 * como antes de esta spec.
 */

/** A quién más avisar de las citas de este recurso. */
export type AvisoDeRecurso = { phone: string; name: string | null };

export type Recurso = {
  id: string;
  name: string;
  /** NULL = hereda el horario del negocio. */
  weeklyHours: WeeklyHours | null;
  color: string | null;
  /** Cuándo corresponde, en palabras. Es lo que lee el agente. */
  criterio: string | null;
  avisos: AvisoDeRecurso[];
  position: number;
};

/**
 * Los avisos vienen de una columna `jsonb`: lo que salga de ahí es
 * `unknown` de verdad —lo escribió una versión anterior, o una mano— así que
 * se valida fila por fila y lo que no sirve se descarta en silencio. Un aviso
 * mal escrito no puede impedir que salgan los demás.
 */
export function parseAvisos(input: unknown): AvisoDeRecurso[] {
  if (!Array.isArray(input)) return [];
  const out: AvisoDeRecurso[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const phone = typeof obj.phone === "string" ? obj.phone.trim() : "";
    if (!phone) continue;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    out.push({ phone, name: name || null });
  }
  return out;
}

/**
 * ¿Esta organización usa agenda por recurso? Una consulta sola porque la
 * respuesta decide cosas que pasan ANTES de tocar la agenda: si el prompt
 * menciona recursos, si la pantalla existe.
 */
export async function organizacionUsaRecursos(
  organizationId: string
): Promise<boolean> {
  const db = getDb();
  const filas = await db
    .select({ on: schema.organization.agendaResources })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  return filas[0]?.on === true;
}

/**
 * Los recursos activos, en orden. **Lista vacía si el interruptor está
 * apagado**, aunque haya filas: apagar tiene que devolver la agenda de antes
 * sin borrarle los datos a nadie.
 */
export async function recursosActivos(
  organizationId: string
): Promise<Recurso[]> {
  if (!(await organizacionUsaRecursos(organizationId))) return [];
  return recursosDeLaOrganizacion(organizationId);
}

/**
 * Los recursos activos SIN mirar el interruptor. Lo usa la pantalla de
 * ajustes, que tiene que poder enseñarlos mientras se configuran, y el aviso,
 * que tiene que poder avisarle al recurso de una cita que ya existe aunque el
 * interruptor se haya apagado después.
 */
export async function recursosDeLaOrganizacion(
  organizationId: string
): Promise<Recurso[]> {
  const db = getDb();
  const filas = await db
    .select({
      id: schema.agendaResource.id,
      name: schema.agendaResource.name,
      weeklyHours: schema.agendaResource.weeklyHours,
      color: schema.agendaResource.color,
      criterio: schema.agendaResource.criterio,
      avisos: schema.agendaResource.avisos,
      position: schema.agendaResource.position,
    })
    .from(schema.agendaResource)
    .where(
      scoped(
        schema.agendaResource.organizationId,
        organizationId,
        eq(schema.agendaResource.active, true)
      )
    )
    .orderBy(asc(schema.agendaResource.position), asc(schema.agendaResource.name));

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    weeklyHours:
      f.weeklyHours == null ? null : normalizeWeeklyHours(f.weeklyHours),
    color: f.color,
    criterio: f.criterio,
    avisos: parseAvisos(f.avisos),
    position: f.position,
  }));
}

/** Un recurso concreto, activo o no: una cita vieja puede apuntar a uno dado de baja. */
export async function recursoPorId(
  organizationId: string,
  resourceId: string
): Promise<Recurso | null> {
  const db = getDb();
  const filas = await db
    .select({
      id: schema.agendaResource.id,
      name: schema.agendaResource.name,
      weeklyHours: schema.agendaResource.weeklyHours,
      color: schema.agendaResource.color,
      criterio: schema.agendaResource.criterio,
      avisos: schema.agendaResource.avisos,
      position: schema.agendaResource.position,
    })
    .from(schema.agendaResource)
    .where(
      scoped(
        schema.agendaResource.organizationId,
        organizationId,
        eq(schema.agendaResource.id, resourceId)
      )
    )
    .limit(1);
  const f = filas[0];
  if (!f) return null;
  return {
    id: f.id,
    name: f.name,
    weeklyHours:
      f.weeklyHours == null ? null : normalizeWeeklyHours(f.weeklyHours),
    color: f.color,
    criterio: f.criterio,
    avisos: parseAvisos(f.avisos),
    position: f.position,
  };
}

/** Sin acentos y en minúsculas: el modelo escribe «Mariel Diaz» tanto como «Mariel Díaz». */
function plano(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * PURA — resuelve el nombre que devolvió el modelo contra los recursos reales.
 * Mismo criterio que `resolveStage()`: exacto, después sin distinguir
 * mayúsculas ni acentos, y por último por nombre de pila si no hay ambigüedad
 * («Mariel» cuando el recurso es «Mariel Díaz»).
 *
 * Sin match devuelve null y quien llama degrada. Nunca adivina entre dos: con
 * dos directores, elegir mal manda a la familia con la persona equivocada.
 */
export function resolverRecurso(
  pedido: string | null | undefined,
  recursos: Recurso[]
): Recurso | null {
  const q = pedido?.trim();
  if (!q || recursos.length === 0) return null;

  const exacto = recursos.find((r) => r.name === q);
  if (exacto) return exacto;

  const qp = plano(q);
  const iguales = recursos.filter((r) => plano(r.name) === qp);
  if (iguales.length === 1) return iguales[0]!;
  if (iguales.length > 1) return null;

  const empiezan = recursos.filter(
    (r) => plano(r.name).startsWith(qp) || qp.startsWith(plano(r.name))
  );
  return empiezan.length === 1 ? empiezan[0]! : null;
}

/**
 * Lo que ve el agente en su prompt. Vacío si no hay recursos: una
 * organización sin ellos no gasta un token en explicarlos.
 */
export function lineasDeRecursos(recursos: Recurso[]): string[] {
  return recursos.map((r) =>
    r.criterio?.trim() ? `- ${r.name} — ${r.criterio.trim()}` : `- ${r.name}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alta, cambio y baja. Lo usa Ajustes → Agenda.
// ─────────────────────────────────────────────────────────────────────────────

import { newId } from "@/lib/db/ids";
import { isResourceColor } from "@/lib/resource-colors";

export class RecursoError extends Error {}

/** Lo que se puede escribir de un recurso. Todo opcional menos el nombre al crear. */
export type RecursoEntrada = {
  name?: string;
  weeklyHours?: WeeklyHours | null;
  color?: string | null;
  criterio?: string | null;
  avisos?: AvisoDeRecurso[];
  active?: boolean;
  position?: number;
};

/**
 * Normaliza lo que llega de la pantalla. Se recorta y se descarta lo
 * inservible en vez de rechazar la fila entera: el horario mal escrito de un
 * día no puede impedir guardar el nombre.
 */
function limpiar(entrada: RecursoEntrada) {
  const out: Record<string, unknown> = {};
  if (entrada.name !== undefined) {
    const n = entrada.name.trim();
    if (!n) throw new RecursoError("El recurso necesita un nombre");
    out.name = n.slice(0, 120);
  }
  if (entrada.weeklyHours !== undefined) {
    out.weeklyHours =
      entrada.weeklyHours == null
        ? null
        : normalizeWeeklyHours(entrada.weeklyHours);
  }
  if (entrada.color !== undefined) {
    // Un color que no está en la paleta se guarda como null y el calendario
    // reparte uno por posición: nunca una clase inventada.
    out.color = isResourceColor(entrada.color) ? entrada.color : null;
  }
  if (entrada.criterio !== undefined) {
    out.criterio = entrada.criterio?.trim().slice(0, 500) || null;
  }
  if (entrada.avisos !== undefined) out.avisos = parseAvisos(entrada.avisos);
  if (entrada.active !== undefined) out.active = entrada.active;
  if (entrada.position !== undefined) out.position = entrada.position;
  return out;
}

export async function crearRecurso(
  organizationId: string,
  entrada: RecursoEntrada
): Promise<string> {
  const db = getDb();
  const campos = limpiar(entrada);
  if (!campos.name) throw new RecursoError("El recurso necesita un nombre");
  const id = newId("agendaResource");
  await db.insert(schema.agendaResource).values({
    id,
    organizationId,
    name: campos.name as string,
    ...campos,
  });
  return id;
}

export async function actualizarRecurso(
  organizationId: string,
  resourceId: string,
  entrada: RecursoEntrada
): Promise<void> {
  const db = getDb();
  const campos = limpiar(entrada);
  if (Object.keys(campos).length === 0) return;
  await db
    .update(schema.agendaResource)
    .set({ ...campos, updatedAt: new Date() })
    .where(
      scoped(
        schema.agendaResource.organizationId,
        organizationId,
        eq(schema.agendaResource.id, resourceId)
      )
    );
}

/**
 * Dar de baja NO borra: desactiva.
 *
 * Borrar dejaría `booking.resource_id` en null —así está el `on delete set
 * null`— y las citas que ya existen pasarían a ser «de la agenda única»,
 * ocupando a todos los demás recursos de golpe. Desactivar las deja donde
 * están y solo impide ofrecer horarios nuevos.
 */
export async function desactivarRecurso(
  organizationId: string,
  resourceId: string
): Promise<void> {
  await actualizarRecurso(organizationId, resourceId, { active: false });
}
