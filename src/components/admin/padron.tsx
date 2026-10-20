"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoOrganizacion } from "@/lib/tenant/estado";
import type { FilaDelPadron } from "@/server/platform/padron";
import {
  altaDeCliente,
  enlaceDeAcceso,
  marcarPago,
  reactivarCliente,
  suspenderCliente,
  type ResultadoAccion,
} from "@/app/admin/actions";

const SIN_RESULTADO: ResultadoAccion = { error: null, aviso: null };

const fecha = new Intl.DateTimeFormat("es", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * 108 — El padrón: la cartera de clientes y lo que se puede hacer con cada uno.
 *
 * Todo lo que escribe pasa por las mismas funciones que el comando de la 104.
 * El panel es una cara para lo que ya existe, no una vía nueva de escribir.
 */
export function Padron({
  clientes,
  operador,
}: {
  clientes: FilaDelPadron[];
  operador: string;
}) {
  const [alta, accionAlta, altaEnCurso] = useActionState(altaDeCliente, SIN_RESULTADO);
  const [abierto, setAbierto] = useState(false);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-text-3">
            La cartera completa. Cada cambio queda registrado a nombre de{" "}
            <span className="font-mono">{operador}</span>.
          </p>
        </div>
        <Button type="button" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cancelar" : "Nuevo cliente"}
        </Button>
      </header>

      {abierto && (
        <form
          action={accionAlta}
          className="space-y-3 rounded-lg border border-line bg-raised p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre del negocio</Label>
              <Input id="nombre" name="nombre" required placeholder="Clínica Sonrisa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Identificador</Label>
              <Input id="slug" name="slug" required placeholder="sonrisa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="correo">Correo del dueño</Label>
              <Input
                id="correo"
                name="correo"
                type="email"
                required
                placeholder="dueno@sonrisa.com"
              />
            </div>
          </div>
          <p className="text-xs text-text-3">
            El identificador será su dirección: <span className="font-mono">
              identificador.chronoslead.com
            </span>. No se puede cambiar después sin romperle los enlaces.
          </p>
          {alta.error && <p className="text-sm text-destructive">{alta.error}</p>}
          {alta.aviso && <EnlaceParaCopiar url={alta.aviso} />}
          <Button type="submit" disabled={altaEnCurso}>
            {altaEnCurso ? "Creando…" : "Crear cliente"}
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Dirección</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Pagado hasta</th>
              <th className="px-3 py-2 font-medium">Alta</th>
              <th className="px-3 py-2 font-medium">Usuarios</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {clientes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-text-3">
                  Todavía no hay clientes. Creá el primero con «Nuevo cliente».
                </td>
              </tr>
            )}
            {clientes.map((c) => (
              <FilaCliente key={c.id} cliente={c} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function FilaCliente({ cliente }: { cliente: FilaDelPadron }) {
  const [pago, accionPago, pagoEnCurso] = useActionState(marcarPago, SIN_RESULTADO);
  const [susp, accionSusp, suspEnCurso] = useActionState(suspenderCliente, SIN_RESULTADO);
  const [reac, accionReac, reacEnCurso] = useActionState(reactivarCliente, SIN_RESULTADO);
  const [enlace, accionEnlace, enlaceEnCurso] = useActionState(
    enlaceDeAcceso,
    SIN_RESULTADO
  );

  const suspendidoAMano =
    cliente.estado.estado === "suspendida" && cliente.estado.motivo === "manual";
  const error = pago.error ?? susp.error ?? reac.error ?? enlace.error;

  return (
    <tr>
      <td className="px-3 py-2 font-medium">{cliente.nombre}</td>
      <td className="px-3 py-2 font-mono text-xs text-text-3">
        {cliente.slug ?? "—"}
      </td>
      <td className="px-3 py-2">
        <Insignia estado={cliente.estado} />
      </td>
      <td className="px-3 py-2 text-text-2">
        {cliente.pagadoHasta ? fecha.format(cliente.pagadoHasta) : "sin fecha"}
      </td>
      <td className="px-3 py-2 text-text-3">{fecha.format(cliente.altaEn)}</td>
      <td className="px-3 py-2 text-text-3">{cliente.usuarios}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <form action={accionPago}>
            <input type="hidden" name="organizationId" value={cliente.id} />
            <Button type="submit" variant="outline" size="sm" disabled={pagoEnCurso}>
              {pagoEnCurso ? "…" : "Marcar pago"}
            </Button>
          </form>

          {suspendidoAMano ? (
            <form action={accionReac}>
              <input type="hidden" name="organizationId" value={cliente.id} />
              <Button type="submit" variant="outline" size="sm" disabled={reacEnCurso}>
                {reacEnCurso ? "…" : "Reactivar"}
              </Button>
            </form>
          ) : (
            <form action={accionSusp} className="flex items-center gap-1.5">
              <input type="hidden" name="organizationId" value={cliente.id} />
              <Input
                name="motivo"
                placeholder="motivo"
                className="h-8 w-28 text-xs"
                required
              />
              <Button type="submit" variant="outline" size="sm" disabled={suspEnCurso}>
                {suspEnCurso ? "…" : "Suspender"}
              </Button>
            </form>
          )}

          <form action={accionEnlace}>
            <input type="hidden" name="organizationId" value={cliente.id} />
            <Button type="submit" variant="outline" size="sm" disabled={enlaceEnCurso}>
              {enlaceEnCurso ? "…" : "Enlace de acceso"}
            </Button>
          </form>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {enlace.aviso && <EnlaceParaCopiar url={enlace.aviso} />}
      </td>
    </tr>
  );
}

function Insignia({ estado }: { estado: EstadoOrganizacion }) {
  if (estado.estado === "activa") {
    return (
      <span className="rounded-full bg-success-tint px-2 py-0.5 text-xs text-success-text">
        activa
      </span>
    );
  }
  if (estado.estado === "gracia") {
    return (
      <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs text-warning-text">
        vencida · {estado.diasRestantes === 0 ? "último día" : `${estado.diasRestantes} d`}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-danger-tint px-2 py-0.5 text-xs text-danger-text">
      suspendida · {estado.motivo === "impago" ? "impago" : "manual"}
    </span>
  );
}

/**
 * El enlace se enseña para copiar y NO se manda solo: el envío por correo
 * necesita un servicio que la constitución descartó. El operador lo pasa por
 * donde quiera, y da igual el canal porque caduca y muere al usarse.
 */
function EnlaceParaCopiar({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-2 space-y-1 rounded-md border border-line bg-subtle p-2">
      <p className="text-xs text-text-3">
        Enlace de primer acceso — sirve una vez y caduca a los 7 días:
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopiado(true);
          }}
        >
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
