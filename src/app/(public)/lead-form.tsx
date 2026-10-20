"use client";

import { useActionState } from "react";
import { capturarLeadAction } from "./actions";

const initial = { error: null, ok: false };

// Alto ticket primero (pedido del equipo comercial, 2026-10-15): son los rubros
// donde el cliente suele calificar y cerrar más rápido.
const RUBROS = [
  "Inmobiliaria",
  "Consultorios y clínicas",
  "Concesionarias",
  "Educación",
  "Restaurantes y delivery",
  "Salud y estética",
  "Servicios profesionales",
  "Otro",
];

const INVIERTE_OPCIONES = ["Sí", "No", "Quiero empezar"];

export function LeadForm() {
  const [state, action, pending] = useActionState(capturarLeadAction, initial);

  if (state.ok) {
    return (
      <div
        data-testid="lead-form-ok"
        className="rounded-2xl bg-white/[0.05] p-6 text-center ring-1 ring-white/10"
      >
        <p className="text-[15px] font-bold text-white">¡Listo! Ya registramos tu consulta.</p>
        <p className="mt-2 text-[13.5px] text-white/70">
          Te escribimos por WhatsApp en breve para coordinar tu diagnóstico gratuito.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      data-testid="form-lead-landing"
      className="rounded-2xl bg-white/[0.05] p-6 ring-1 ring-white/10 shadow-[0_18px_45px_-24px_rgba(0,0,0,.8)]"
    >
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/70">
        ¿Preferís que te contactemos?
      </p>
      <div className="mt-5 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-white/70">Nombre *</span>
          <input
            name="name"
            required
            placeholder="Tu nombre"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[14px] text-white outline-none transition [color-scheme:dark] placeholder:text-white/40 focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-white/70">WhatsApp *</span>
          <input
            name="phone"
            required
            placeholder="+595 981 123 456"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[14px] text-white outline-none transition [color-scheme:dark] placeholder:text-white/40 focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-white/70">Rubro *</span>
          <select
            name="rubro"
            required
            defaultValue=""
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[14px] text-white outline-none transition [color-scheme:dark] focus:border-primary focus:ring-4 focus:ring-primary/15"
          >
            <option value="" disabled>
              Seleccioná una opción
            </option>
            {RUBROS.map((r) => (
              <option key={r} value={r} className="text-ink">
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-white/70">Empresa</span>
          <input
            name="empresa"
            placeholder="Nombre de tu empresa"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[14px] text-white outline-none transition [color-scheme:dark] placeholder:text-white/40 focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <div className="space-y-2">
          <span className="text-[12px] font-semibold text-white/70">¿Ya invertís en anuncios?</span>
          <div className="flex gap-2">
            {INVIERTE_OPCIONES.map((o) => (
              <label
                key={o}
                className="flex-1 cursor-pointer rounded-xl border border-white/15 px-3 py-2 text-center text-[13px] font-semibold text-white/70 transition has-[:checked]:border-primary has-[:checked]:text-[#FF8F3D] hover:border-primary hover:text-[#FF8F3D]"
              >
                <input type="radio" name="yaInvierteEnAnuncios" value={o} className="sr-only" />
                {o}
              </label>
            ))}
          </div>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-6 h-12 w-full rounded-xl bg-primary text-[14.5px] font-bold text-white shadow-[0_12px_26px_-8px_rgba(255,106,0,.7)] transition hover:bg-[#E24D00] active:scale-[.98] disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Quiero que me escriban →"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-3 text-center text-[12px] text-red-300">
          {state.error}
        </p>
      ) : (
        <p className="mt-3 text-center text-[12px] text-white/60">
          Nuestro equipo te escribe por WhatsApp en minutos para coordinar tu diagnóstico.
        </p>
      )}
    </form>
  );
}
