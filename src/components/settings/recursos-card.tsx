"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  RESOURCE_COLORS,
  RESOURCE_COLOR_KEYS,
  resourceColorClass,
} from "@/lib/resource-colors";

/**
 * 146 — Ajustes → Agenda → quién atiende.
 *
 * La tarjeta **no existe** si la organización no tiene la agenda por recurso
 * encendida: el endpoint responde 404 y acá no se dibuja nada. Para ocho de
 * los nueve clientes esta pantalla es idéntica a la de antes de la spec.
 */

type Interval = { start: string; end: string };
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type WeeklyHours = Partial<Record<DayKey, Interval[]>>;
type Aviso = { phone: string; name: string | null };

type Recurso = {
  id: string;
  name: string;
  weeklyHours: WeeklyHours | null;
  color: string | null;
  criterio: string | null;
  avisos: Aviso[];
  position: number;
};

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lun" },
  { key: "tue", label: "Mar" },
  { key: "wed", label: "Mié" },
  { key: "thu", label: "Jue" },
  { key: "fri", label: "Vie" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

const FRANJA: Interval = { start: "09:00", end: "18:00" };

export function RecursosCard() {
  const [recursos, setRecursos] = useState<Recurso[] | null>(null);
  /** null = todavía no sabemos; false = esta organización no los usa. */
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const res = await fetch("/api/calendar/resources").catch(() => null);
    if (!res) return;
    if (res.status === 404) {
      setDisponible(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      recursos?: Recurso[];
    } | null;
    setDisponible(true);
    setRecursos(data?.recursos ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function crear() {
    const name = nuevo.trim();
    if (!name) return;
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/calendar/resources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      setError("No se pudo crear");
      return;
    }
    setNuevo("");
    await cargar();
  }

  async function guardar(id: string, cambios: Partial<Recurso>) {
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/calendar/resources/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cambios),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      setError("No se pudo guardar");
      return;
    }
    await cargar();
  }

  async function darDeBaja(id: string) {
    setGuardando(true);
    await fetch(`/api/calendar/resources/${id}`, { method: "DELETE" }).catch(
      () => null
    );
    setGuardando(false);
    await cargar();
  }

  if (disponible !== true) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quién atiende</CardTitle>
        <CardDescription>
          Cada persona de esta lista tiene su propia agenda: que una ocupe un
          horario no se lo quita a las demás. El agente elige a quién ofrecerle
          según lo que escribas en «cuándo corresponde».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {recursos?.length === 0 && (
          <p className="text-sm text-text-3">
            Todavía no cargaste a nadie. Mientras la lista esté vacía, la agenda
            funciona como siempre: una sola.
          </p>
        )}

        {recursos?.map((r, i) => (
          <FichaDeRecurso
            key={r.id}
            recurso={r}
            indice={i}
            guardando={guardando}
            onGuardar={(c) => guardar(r.id, c)}
            onBaja={() => darDeBaja(r.id)}
          />
        ))}

        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <div className="space-y-1">
            <Label htmlFor="recurso-nuevo" className="text-[11px]">
              Sumar a alguien
            </Label>
            <Input
              id="recurso-nuevo"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              placeholder="Nombre y apellido"
              className="h-9 w-64"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void crear()}
            disabled={guardando || !nuevo.trim()}
          >
            Sumar
          </Button>
        </div>

        {error && <p className="text-sm text-danger-text">{error}</p>}
      </CardContent>
    </Card>
  );
}

function FichaDeRecurso({
  recurso,
  indice,
  guardando,
  onGuardar,
  onBaja,
}: {
  recurso: Recurso;
  indice: number;
  guardando: boolean;
  onGuardar: (cambios: Partial<Recurso>) => void;
  onBaja: () => void;
}) {
  const [name, setName] = useState(recurso.name);
  /**
   * 146 — El color se guarda con «Guardar», como todo lo demás.
   *
   * La primera versión lo guardaba en el acto, al hacer clic en el círculo.
   * Parecía cómodo y era una trampa: guardar recarga la lista desde el
   * servidor, así que elegir un color BORRABA el criterio y los teléfonos que
   * todavía no se habían guardado. Lo descubrí cargando a los dos directores
   * de Cerritos, perdiendo lo que acababa de escribir.
   */
  const [color, setColor] = useState(recurso.color);
  const [criterio, setCriterio] = useState(recurso.criterio ?? "");
  const [avisos, setAvisos] = useState<Aviso[]>(recurso.avisos);
  const [horas, setHoras] = useState<WeeklyHours | null>(recurso.weeklyHours);

  const propio = horas !== null;

  function cambiarDia(key: DayKey, intervals: Interval[]) {
    setHoras({ ...(horas ?? {}), [key]: intervals });
  }

  return (
    <div className="space-y-3 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Color en el calendario</Label>
          <div className="flex items-center gap-1.5">
            {RESOURCE_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={RESOURCE_COLORS[c].label}
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform",
                  RESOURCE_COLORS[c].bg,
                  color === c
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105"
                )}
              />
            ))}
          </div>
        </div>
        <span
          className={cn(
            "ml-auto h-6 w-6 shrink-0 rounded-full",
            resourceColorClass(color, indice)
          )}
          aria-hidden
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Cuándo corresponde</Label>
        <Input
          value={criterio}
          onChange={(e) => setCriterio(e.target.value)}
          placeholder="cuando el alumno va de 4.º grado en adelante"
          className="h-9"
        />
        <p className="text-[11px] text-text-3">
          Esto lo lee el agente para decidir a quién ofrecerle horarios. Escribilo
          como se lo explicarías a alguien que recién entra.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-[11px]">Horario</Label>
          <button
            type="button"
            onClick={() => setHoras(propio ? null : { mon: [FRANJA] })}
            className="text-xs text-brand-text hover:underline"
          >
            {propio ? "usar el del negocio" : "darle un horario propio"}
          </button>
        </div>
        {!propio ? (
          <p className="text-sm text-text-3">
            Atiende en el horario del negocio.
          </p>
        ) : (
          <div className="space-y-1.5">
            {DAYS.map((d) => {
              const intervals = horas?.[d.key] ?? [];
              const abierto = intervals.length > 0;
              return (
                <div key={d.key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      cambiarDia(d.key, abierto ? [] : [FRANJA])
                    }
                    className={cn(
                      "w-14 shrink-0 rounded-sm px-2 py-1 text-left text-xs font-medium",
                      abierto
                        ? "bg-brand-tint text-brand-text"
                        : "text-text-3 hover:bg-accent"
                    )}
                  >
                    {d.label}
                  </button>
                  {!abierto && (
                    <span className="text-xs text-text-3">Cerrado</span>
                  )}
                  {intervals.map((iv, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={iv.start}
                        onChange={(e) =>
                          cambiarDia(
                            d.key,
                            intervals.map((x, j) =>
                              j === i ? { ...x, start: e.target.value } : x
                            )
                          )
                        }
                        className="h-8 w-28"
                      />
                      <span className="text-xs text-text-3">a</span>
                      <Input
                        type="time"
                        value={iv.end}
                        onChange={(e) =>
                          cambiarDia(
                            d.key,
                            intervals.map((x, j) =>
                              j === i ? { ...x, end: e.target.value } : x
                            )
                          )
                        }
                        className="h-8 w-28"
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">A quién avisar de estas citas</Label>
        <p className="text-[11px] text-text-3">
          Además de quien recibe todos los avisos del negocio. Cada persona de
          acá recibe el aviso al agendar y el recordatorio una hora antes.
        </p>
        {avisos.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={a.name ?? ""}
              onChange={(e) =>
                setAvisos(
                  avisos.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x
                  )
                )
              }
              placeholder="Nombre"
              className="h-8 w-40"
            />
            <Input
              value={a.phone}
              onChange={(e) =>
                setAvisos(
                  avisos.map((x, j) =>
                    j === i ? { ...x, phone: e.target.value } : x
                  )
                )
              }
              placeholder="+595 981 123 456"
              className="h-8 w-48"
            />
            <button
              type="button"
              onClick={() => setAvisos(avisos.filter((_, j) => j !== i))}
              className="text-sm text-text-3 hover:text-foreground"
              aria-label="Quitar"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAvisos([...avisos, { phone: "", name: "" }])}
          className="text-xs text-brand-text hover:underline"
        >
          + sumar a alguien
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-line pt-2">
        <Button
          type="button"
          size="sm"
          disabled={guardando}
          onClick={() =>
            onGuardar({
              name,
              color,
              criterio: criterio.trim() || null,
              avisos: avisos.filter((a) => a.phone.trim()),
              weeklyHours: horas,
            })
          }
        >
          Guardar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={guardando}
          onClick={onBaja}
        >
          Dar de baja
        </Button>
        <span className="text-[11px] text-text-3">
          Dar de baja no borra sus citas: deja de ofrecerse para las nuevas.
        </span>
      </div>
    </div>
  );
}
