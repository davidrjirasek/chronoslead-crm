import Link from "next/link";
import { Salir } from "@/components/admin/salir";
import { totalDe } from "@/server/cuestionario/secciones";
import type { EnLaLista } from "@/server/cuestionario/store";

/**
 * 128 — La lista de cuestionarios en el panel del operador.
 *
 * Muestra el avance REAL —secciones con alguna respuesta— y no solo si
 * terminó: lo útil para el negocio es ver a quién se le quedó a medias, para
 * poder llamarlo.
 */
export function ListaDeCuestionarios({ filas }: { filas: EnLaLista[] }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl text-foreground tracking-tight">Cuestionarios</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Lo que completaron los clientes en{" "}
            <span className="font-mono">onboarding.chronoslead.com</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[13.5px] font-medium text-primary hover:underline">
            ← Clientes
          </Link>
          <Salir />
        </div>
      </header>

      {filas.length === 0 ? (
        <p className="mt-10 rounded-xl border bg-subtle px-5 py-8 text-center text-[14px] text-muted-foreground">
          Todavía no completó nadie. Cuando mandes el enlace y alguien escriba algo, aparece acá
          aunque no lo haya terminado.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {filas.map((f) => {
            const total = totalDe(f.variante);
            return (
            <li key={f.llave}>
              <Link
                href={`/admin/cuestionarios/${encodeURIComponent(f.llave)}`}
                className="block rounded-xl border bg-background p-5 transition hover:bg-subtle"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[15px] text-foreground">{f.cliente}</p>
                  <Estado enviado={f.enviadoAt !== null} />
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {f.contacto || "sin nombre de contacto"}
                  {f.correo ? ` · ${f.correo}` : ""}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(f.contestadas / total) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                    {f.contestadas}/{total}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Última actividad: {cuando(f.updatedAt)}
                </p>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Estado({ enviado }: { enviado: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
        enviado ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {enviado ? "Enviado" : "A medias"}
    </span>
  );
}

/** Fecha corta y estable. Sin «hace 3 horas»: el operador compara con su reloj. */
function cuando(d: Date): string {
  return new Date(d).toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
