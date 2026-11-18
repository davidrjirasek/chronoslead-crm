import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  addDaysISO,
  eachDateInRange,
  expandWorkingDayToUtc,
  labelInTz,
  overlaps,
  todayInTz,
  weekdayKeyOf,
  zonedWallClockToUtc,
  type SlotUtc,
} from "@/lib/time/slots";
import { getSettings, type CalendarSettings } from "@/server/agenda/settings";
import type { Recurso } from "@/server/agenda/recursos";

/**
 * 015 — Motor de disponibilidad:
 *   horario semanal del negocio − citas activas − bloqueos manuales.
 *
 * Limitación v1 documentada (Constitución VII): NO lee calendarios externos.
 * Es una decisión, no un olvido: meter al proveedor en este camino acoplaría su
 * latencia y sus caídas a la pantalla que más se usa. Los compromisos de fuera
 * se reflejan con bloqueos manuales.
 */

export type AvailableSlot = SlotUtc & { label: string };

/**
 * PURA: expande el horario semanal a slots candidatos en UTC. Sin BD, sin
 * reloj — se testea sola (tests/unit/availability.test.ts).
 */
export function buildCandidateSlots(
  settings: CalendarSettings,
  fromISO: string,
  toISO: string
): SlotUtc[] {
  const tz = settings.timezone;
  const candidates: SlotUtc[] = [];
  for (const date of eachDateInRange(fromISO, toISO)) {
    const weekday = weekdayKeyOf(date, tz);
    if (!weekday) continue;
    const intervals = settings.weeklyHours[weekday] ?? [];
    if (intervals.length === 0) continue; // día cerrado
    candidates.push(
      ...expandWorkingDayToUtc(
        date,
        intervals,
        tz,
        settings.slotMinutes,
        settings.bufferMinutes
      )
    );
  }
  return candidates;
}

/**
 * PURA: descarta lo que ya pasó (con aviso mínimo) y lo que se solapa con algo
 * ocupado, ordena y etiqueta.
 */
export function filterFreeSlots(
  candidates: SlotUtc[],
  busy: SlotUtc[],
  opts: { now: Date; minNoticeHours: number; timezone: string }
): AvailableSlot[] {
  const minStartMs = opts.now.getTime() + opts.minNoticeHours * 3_600_000;
  return candidates
    .filter((c) => Date.parse(c.startUtc) >= minStartMs)
    .filter(
      (c) =>
        !busy.some((b) => overlaps(c.startUtc, c.endUtc, b.startUtc, b.endUtc))
    )
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))
    .map((c) => ({ ...c, label: labelInTz(c.startUtc, opts.timezone) }));
}

/**
 * 146 — El horario que rige para este recurso: el suyo si lo tiene cargado, el
 * del negocio si no. PURA, para poder probar la herencia sin base.
 */
export function horarioDelRecurso(
  settings: CalendarSettings,
  recurso?: Recurso | null
): CalendarSettings {
  if (!recurso?.weeklyHours) return settings;
  return { ...settings, weeklyHours: recurso.weeklyHours };
}

export async function computeAvailability(
  organizationId: string,
  opts?: {
    fromISO?: string;
    toISO?: string;
    excludeBookingId?: string;
    now?: Date;
    settings?: CalendarSettings;
    /**
     * 146 — De quién es la agenda. Sin recurso, el comportamiento es el de
     * siempre: TODAS las citas de la organización ocupan.
     */
    recurso?: Recurso | null;
  }
): Promise<AvailableSlot[]> {
  const base = opts?.settings ?? (await getSettings(organizationId));
  const settings = horarioDelRecurso(base, opts?.recurso);
  const now = opts?.now ?? new Date();
  const tz = settings.timezone;

  const from = opts?.fromISO ?? todayInTz(now, tz);
  const to = opts?.toISO ?? addDaysISO(from, settings.maxDaysAhead);

  const candidates = buildCandidateSlots(settings, from, to);
  if (candidates.length === 0) return [];

  const busy = await getBusyIntervals(organizationId, {
    fromUtc: zonedWallClockToUtc(from, "00:00", tz) ?? new Date(0),
    toUtc:
      zonedWallClockToUtc(addDaysISO(to, 1), "00:00", tz) ??
      new Date(now.getTime() + 86_400_000 * 61),
    excludeBookingId: opts?.excludeBookingId,
    resourceId: opts?.recurso?.id ?? null,
  });

  return filterFreeSlots(candidates, busy, {
    now,
    minNoticeHours: settings.minNoticeHours,
    timezone: tz,
  });
}

/**
 * Re-valida que un instante concreto siga libre. Se llama AL CONFIRMAR, nunca
 * al ofrecer. `excludeBookingId` permite reprogramar sin que la propia cita se
 * bloquee a sí misma.
 *
 * Solo recalcula ±1 día alrededor del instante pedido.
 *
 * OJO: esto reduce la ventana de la carrera, no la cierra — entre este SELECT
 * y el INSERT cabe otra confirmación. Quien cierra de verdad es el índice
 * único parcial de `booking` (research D7); esto existe para dar una respuesta
 * útil (con alternativas) en el caso normal.
 */
export async function findSlot(
  organizationId: string,
  whenISO: string,
  opts?: {
    excludeBookingId?: string;
    now?: Date;
    settings?: CalendarSettings;
    /** 146 — Re-validar contra la agenda de ESTE recurso, no la de todos. */
    recurso?: Recurso | null;
  }
): Promise<AvailableSlot | null> {
  const target = Date.parse(whenISO);
  if (Number.isNaN(target)) return null;

  const settings = opts?.settings ?? (await getSettings(organizationId));
  const dayInTz = todayInTz(new Date(target), settings.timezone);

  const slots = await computeAvailability(organizationId, {
    fromISO: addDaysISO(dayInTz, -1),
    toISO: addDaysISO(dayInTz, 1),
    excludeBookingId: opts?.excludeBookingId,
    now: opts?.now,
    settings,
    recurso: opts?.recurso,
  });
  return slots.find((s) => Date.parse(s.startUtc) === target) ?? null;
}

async function getBusyIntervals(
  organizationId: string,
  input: {
    fromUtc: Date;
    toUtc: Date;
    excludeBookingId?: string;
    /**
     * 146 — Con recurso, solo ocupan SUS citas y los bloqueos sin recurso.
     * Null —la agenda única— mantiene el comportamiento de siempre: ocupa
     * todo lo de la organización.
     */
    resourceId?: string | null;
  }
): Promise<SlotUtc[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.booking.id,
      scheduledAt: schema.booking.scheduledAt,
      durationMinutes: schema.booking.durationMinutes,
    })
    .from(schema.booking)
    .where(
      scoped(
        schema.booking.organizationId,
        organizationId,
        and(
          // Canceladas y no-show liberan el hueco.
          inArray(schema.booking.status, ["agendada", "realizada"]),
          // Sandbox: una cita de prueba no consume la agenda real.
          eq(schema.booking.isTest, false),
          gte(schema.booking.scheduledAt, input.fromUtc),
          lte(schema.booking.scheduledAt, input.toUtc),
          // 146 — Un bloqueo SIN recurso ocupa a todos: las vacaciones son del
          // negocio, no de una persona. Una cita de otro recurso no ocupa.
          input.resourceId
            ? or(
                eq(schema.booking.resourceId, input.resourceId),
                isNull(schema.booking.resourceId)
              )
            : undefined
        )
      )
    );

  return rows
    .filter((r) => r.id !== input.excludeBookingId)
    .map((r) => ({
      startUtc: r.scheduledAt.toISOString(),
      endUtc: new Date(
        r.scheduledAt.getTime() + r.durationMinutes * 60_000
      ).toISOString(),
    }));
}
