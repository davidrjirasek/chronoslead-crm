"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarDays, Sparkles, Video } from "lucide-react";
import { bookingSegments, hhmm, longDayLabel, spanLabel, type DateRange } from "@/lib/time/calendar";
import { cn } from "@/lib/utils";
import { resourceColorClass } from "@/lib/resource-colors";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_LABEL, bookingTitle, bookingTone, hasDeliveryIssue, type Booking } from "./booking-look";

/**
 * 215 — La Lista: las citas del rango, agrupadas por día, como la «Agenda» de
 * Google o la lista de reuniones de Zoom. Es la vista para revisar qué viene
 * (o qué pasó) sin buscar en la rejilla.
 */
export function AgendaList({
  range,
  bookings,
  timezone,
  today,
  selectedId,
  onSelect,
  recursos = [],
}: {
  range: DateRange;
  bookings: Booking[];
  timezone: string;
  today: string;
  selectedId: string | null;
  onSelect: (b: Booking) => void;
  /** 146 — Para pintar de qué agenda es cada cita. Vacío = una sola agenda. */
  recursos?: { id: string; name: string; color: string | null }[];
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { booking: Booking; startMin: number; endMin: number }[]>();
    for (const b of bookings) {
      const segs = bookingSegments(b.scheduledAtUtc, b.durationMinutes, timezone);
      const first = segs[0];
      const last = segs[segs.length - 1];
      if (!first || !last || first.day < range.from || first.day > range.to) continue;
      const list = map.get(first.day) ?? [];
      list.push({ booking: b, startMin: first.startMin, endMin: last.endMin });
      map.set(first.day, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, items]) => ({ day, items: items.sort((a, b) => a.startMin - b.startMin) }));
  }, [bookings, timezone, range.from, range.to]);

  // 146 — Índice por id para pintar el color sin recorrer la lista por cita.
  const porRecurso = useMemo(
    () => new Map(recursos.map((r, i) => [r.id, { ...r, indice: i }])),
    [recursos]
  );

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        className="min-h-0 flex-1 rounded-lg border bg-card p-8"
        title={`Nada agendado del ${spanLabel(range)}`}
        description="Aquí aparecen las citas que agenda la IA o tu equipo. El horario que se ofrece se configura en Ajustes → Agenda."
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
      {groups.map(({ day, items }) => (
        <section key={day}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b bg-subtle px-4 py-2 text-[13px] font-semibold first-letter:uppercase">
            {longDayLabel(day)}
            {day === today && (
              <span className="rounded-full bg-brand px-2 py-px text-[10.5px] font-semibold text-brand-fg">
                Hoy
              </span>
            )}
          </h3>
          <ul className="divide-y">
            {items.map(({ booking: b, startMin, endMin }) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-soft",
                    b.id === selectedId && "bg-row-hover"
                  )}
                >
                  <span className="w-[6.5rem] shrink-0 font-mono text-[12px] text-text-2">
                    {hhmm(startMin)} – {hhmm(endMin)}
                  </span>
                  <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", bookingTone(b).dot)} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 truncate text-sm font-semibold",
                        b.status === "cancelada" && "text-text-3 line-through"
                      )}
                    >
                      <span className="truncate">{bookingTitle(b)}</span>
                      {/* 146 — De qué agenda es. Solo aparece donde hay más
                          de una: en las demás no sobra ni un píxel. */}
                      {(() => {
                        const r = b.resourceId
                          ? porRecurso.get(b.resourceId)
                          : null;
                        if (!r) return null;
                        return (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-3">
                            <span
                              aria-hidden
                              className={cn(
                                "h-2 w-2 rounded-full",
                                resourceColorClass(r.color, r.indice)
                              )}
                            />
                            {r.name}
                          </span>
                        );
                      })()}
                      {b.source === "ai" && b.kind === "session" && (
                        <Sparkles aria-label="Agendó la IA" className="h-3.5 w-3.5 shrink-0 text-brand-text" />
                      )}
                    </span>
                    <span className="block truncate text-xs text-text-3">
                      {b.kind === "block"
                        ? `Bloqueo · ${b.durationMinutes} min`
                        : `${b.durationMinutes} min · ${b.source === "ai" ? "Agendó la IA" : "Manual"}${b.isTest ? " · Prueba" : ""}`}
                    </span>
                  </span>
                  {hasDeliveryIssue(b) && (
                    <AlertTriangle aria-label="Sin enlace de la reunión" className="h-4 w-4 shrink-0 text-warning-text" />
                  )}
                  {b.meetingLink && b.status === "agendada" && (
                    <Video aria-label="Tiene enlace de reunión" className="hidden h-4 w-4 shrink-0 text-text-3 sm:block" />
                  )}
                  <span className="hidden shrink-0 text-xs font-medium text-text-2 sm:block">
                    {b.kind === "block" ? (b.status === "cancelada" ? "Bloqueo quitado" : "Bloqueo") : STATUS_LABEL[b.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
