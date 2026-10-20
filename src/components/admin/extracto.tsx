import { formatMoneyCents } from "@/lib/money";
import type { PagoDelHistorico } from "@/server/platform/padron";
import { BotonImprimir } from "@/components/admin/boton-imprimir";

const fecha = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const fechaCorta = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * 109 — El extracto de cobros de un cliente, pensado para imprimirse.
 *
 * Papel y no pantalla: fondo blanco, sin el patrón de marca, sin sombras y con
 * los controles marcados `print:hidden`. Un extracto con el fondo decorativo
 * detrás gasta tinta y se lee peor, y es lo que el cliente va a archivar.
 */
export function Extracto({
  nombre,
  slug,
  altaEn,
  pagos,
  emitidoPor,
}: {
  nombre: string;
  slug: string | null;
  altaEn: Date;
  pagos: PagoDelHistorico[];
  emitidoPor: string;
}) {
  // Un total por moneda: sumar pesos y dólares daría un número que no existe.
  const totales = new Map<string, number>();
  for (const p of pagos) {
    totales.set(p.moneda, (totales.get(p.moneda) ?? 0) + p.importeCentavos);
  }

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-[#0b0b0b] print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-[#6b6b6b]">
          Usá <strong>Cmd+P</strong> y elegí «Guardar como PDF» para archivarlo o
          mandárselo al cliente.
        </p>
        <BotonImprimir />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-[#ff6a00] pb-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight">
              Chronos<span className="text-[#ff6a00]">Lead</span>
            </p>
            <p className="text-[11px] text-[#6b6b6b]">Un producto de Creativo 4D Group</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">Extracto de cobros</p>
          <p className="text-[#6b6b6b]">Emitido el {fecha.format(new Date())}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#6b6b6b]">Cliente</p>
          <p className="text-base font-semibold">{nombre}</p>
          {slug && <p className="font-mono text-xs text-[#6b6b6b]">{slug}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-[#6b6b6b]">
            Cliente desde
          </p>
          <p>{fecha.format(altaEn)}</p>
        </div>
      </section>

      {pagos.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#6b6b6b]">
          Todavía no hay cobros registrados para este cliente.
        </p>
      ) : (
        <>
          <table className="mt-7 w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8d8d8] text-left text-[11px] uppercase tracking-wide text-[#6b6b6b]">
                <th className="py-2 pr-3 font-medium">Fecha de cobro</th>
                <th className="py-2 pr-3 font-medium">Periodo cubierto</th>
                <th className="py-2 pr-3 font-medium">Forma / nota</th>
                <th className="py-2 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {/* Del más viejo al más nuevo: un extracto se lee hacia adelante. */}
              {[...pagos].reverse().map((p) => (
                <tr key={p.id} className="border-b border-[#eeeeee]">
                  <td className="py-2 pr-3">{fechaCorta.format(p.cobradoEn)}</td>
                  <td className="py-2 pr-3 text-[#6b6b6b]">
                    {fechaCorta.format(p.cubreDesde)} — {fechaCorta.format(p.cubreHasta)}
                  </td>
                  <td className="py-2 pr-3 text-[#6b6b6b]">{p.nota ?? "—"}</td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatMoneyCents(p.importeCentavos, p.moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {[...totales.entries()].map(([moneda, centavos]) => (
                <tr key={moneda}>
                  <td colSpan={3} className="pt-3 text-right font-semibold">
                    Total cobrado
                    {totales.size > 1 ? ` en ${moneda}` : ""}
                  </td>
                  <td className="pt-3 text-right text-base font-bold tabular-nums">
                    {formatMoneyCents(centavos, moneda)}
                  </td>
                </tr>
              ))}
            </tfoot>
          </table>

          <p className="mt-2 text-[11px] text-[#6b6b6b]">
            {pagos.length} {pagos.length === 1 ? "cobro registrado" : "cobros registrados"}
            {totales.size > 1 && " · los totales van por moneda: sumarlas daría una cifra que no existe"}
          </p>
        </>
      )}

      <footer className="mt-10 border-t border-[#d8d8d8] pt-4 text-[11px] leading-relaxed text-[#6b6b6b]">
        <p>
          Documento informativo emitido por {emitidoPor} desde el panel de ChronosLead.
          Refleja los cobros registrados en la plataforma y <strong>no sustituye</strong>{" "}
          a una factura ni a un comprobante fiscal.
        </p>
      </footer>
    </main>
  );
}
