"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Link2, Plus } from "lucide-react";
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
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * 108 — El padrón.
 *
 * La primera versión metía los cuatro controles dentro de una celda: los
 * botones se partían en dos líneas, el de guardar se encogía a «…» al pulsarlo,
 * el campo de motivo ocupaba sitio aunque no se usara y la tabla se desbordaba
 * por la derecha. No cabía ni en un portátil.
 *
 * Ahora la lista **informa** y las acciones viven en un panel que se abre bajo
 * el cliente, a todo el ancho: hay sitio para decir qué pasó, el motivo se pide
 * solo cuando hace falta, y en un teléfono los datos se apilan en vez de
 * salirse de la pantalla.
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
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <main className="cl-marca min-h-screen pb-16">
      <div className="cl-superficie border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-3.5 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.png" alt="" aria-hidden className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold leading-tight tracking-tight">
              Chronos<span className="text-brand">Lead</span>
            </p>
            <p className="text-[11px] text-text-3">Panel del operador</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-text-3">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} · cada
              cambio queda registrado a nombre de{" "}
              <span className="font-mono text-[12px]">{operador}</span>
            </p>
          </div>
          <Button type="button" onClick={() => setAbierto((v) => !v)}>
            {abierto ? (
              "Cancelar"
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.2} />
                Nuevo cliente
              </>
            )}
          </Button>
        </header>

        {abierto && (
          // Tras crear con éxito el formulario NO se cierra: ahí está el enlace
          // que hay que copiar, y cerrarlo lo perdería.
          <form
            action={accionAlta}
            className="cl-superficie space-y-3 rounded-xl border border-line p-4 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo
                id="nombre"
                etiqueta="Nombre del negocio"
                ejemplo="Clínica Sonrisa"
                ayuda="Como lo verá el cliente."
              />
              <Campo
                id="slug"
                etiqueta="Identificador"
                ejemplo="sonrisa"
                ayuda="Será su dirección web. No se puede cambiar después."
              />
              <Campo
                id="correo"
                etiqueta="Correo del dueño"
                ejemplo="dueno@sonrisa.com"
                tipo="email"
                ayuda="A este correo se asocia su cuenta."
              />
            </div>
            {alta.error && <Aviso tono="error">{alta.error}</Aviso>}
            {alta.aviso && <EnlaceDeAcceso url={alta.aviso} motivo="alta" />}
            <Button type="submit" disabled={altaEnCurso}>
              {altaEnCurso ? "Creando…" : "Crear cliente"}
            </Button>
          </form>
        )}

        <div className="cl-superficie overflow-hidden rounded-xl border border-line">
          {clientes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-3">
              Todavía no hay clientes. Creá el primero con «Nuevo cliente».
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {clientes.map((c) => (
                <Cliente
                  key={c.id}
                  cliente={c}
                  abierto={expandido === c.id}
                  alternar={() => setExpandido((id) => (id === c.id ? null : c.id))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function Campo({
  id,
  etiqueta,
  ejemplo,
  ayuda,
  tipo = "text",
}: {
  id: string;
  etiqueta: string;
  ejemplo: string;
  ayuda: string;
  tipo?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={id} type={tipo} required placeholder={ejemplo} />
      <p className="text-[11px] leading-snug text-text-3">{ayuda}</p>
    </div>
  );
}

function Aviso({
  tono,
  children,
}: {
  tono: "error" | "ok";
  children: React.ReactNode;
}) {
  const estilo =
    tono === "error"
      ? "bg-danger-tint text-danger-text"
      : "bg-success-tint text-success-text";
  return <p className={`rounded-md px-3 py-2 text-sm ${estilo}`}>{children}</p>;
}

/**
 * Una fila: lo que hay que saber de un vistazo y UN botón para actuar. En un
 * teléfono los datos se apilan en vez de salirse por la derecha.
 */
function Cliente({
  cliente,
  abierto,
  alternar,
}: {
  cliente: FilaDelPadron;
  abierto: boolean;
  alternar: () => void;
}) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate font-semibold">{cliente.nombre}</p>
          <p className="truncate font-mono text-[11px] text-text-3">
            {cliente.slug ?? "—"}
          </p>
        </div>

        <Insignia estado={cliente.estado} />

        <div className="basis-36 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-text-4">Pagado hasta</p>
          <p className={cliente.pagadoHasta ? "text-text-2" : "text-text-4"}>
            {cliente.pagadoHasta ? fecha.format(cliente.pagadoHasta) : "sin fecha"}
          </p>
        </div>

        <div className="basis-20 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-text-4">Usuarios</p>
          <p className="text-text-2">{cliente.usuarios}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={alternar}
          aria-expanded={abierto}
        >
          Gestionar
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </Button>
      </div>

      {abierto && <Acciones cliente={cliente} />}
    </li>
  );
}

/** El panel de acciones, a todo el ancho: aquí sí hay sitio para explicar. */
function Acciones({ cliente }: { cliente: FilaDelPadron }) {
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
    <div className="space-y-4 border-t border-line bg-brand-tint/50 px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque
          titulo="Registrar un pago"
          ayuda="Sin fecha suma un mes desde hoy; con fecha, la deja hasta ese día."
        >
          <form action={accionPago} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="organizationId" value={cliente.id} />
            <div className="space-y-1">
              <Label htmlFor={`hasta-${cliente.id}`} className="text-[11px]">
                Hasta (opcional)
              </Label>
              <Input
                id={`hasta-${cliente.id}`}
                name="hasta"
                type="date"
                className="h-9 w-40"
              />
            </div>
            <Button type="submit" size="sm" disabled={pagoEnCurso}>
              {pagoEnCurso ? "Guardando…" : "Marcar pago"}
            </Button>
          </form>
          {/* Lo que pasó, no solo que el botón dejó de girar. */}
          <p className="flex items-center gap-1.5 text-xs text-text-3">
            <Check className="h-3.5 w-3.5 shrink-0 text-success-text" strokeWidth={2.4} />
            {cliente.pagadoHasta
              ? `Ahora está pagado hasta el ${fecha.format(cliente.pagadoHasta)}.`
              : "Todavía sin fecha de pago."}
          </p>
        </Bloque>

        <Bloque
          titulo={suspendidoAMano ? "Reactivar el servicio" : "Suspender el servicio"}
          ayuda={
            suspendidoAMano
              ? "Vuelve a entrar y la fecha de pago manda otra vez. Sus datos siguen intactos."
              : "Deja de entrar, pero sus mensajes se siguen guardando. Pagar NO la reactiva: la levantás vos."
          }
        >
          {suspendidoAMano ? (
            <form action={accionReac}>
              <input type="hidden" name="organizationId" value={cliente.id} />
              <Button type="submit" size="sm" variant="outline" disabled={reacEnCurso}>
                {reacEnCurso ? "Reactivando…" : "Reactivar"}
              </Button>
            </form>
          ) : (
            <form action={accionSusp} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="organizationId" value={cliente.id} />
              <div className="space-y-1">
                <Label htmlFor={`motivo-${cliente.id}`} className="text-[11px]">
                  Motivo
                </Label>
                <Input
                  id={`motivo-${cliente.id}`}
                  name="motivo"
                  required
                  placeholder="a petición del cliente"
                  className="h-9 w-56"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={suspEnCurso}>
                {suspEnCurso ? "Suspendiendo…" : "Suspender"}
              </Button>
            </form>
          )}
          {cliente.estado.estado === "suspendida" &&
            cliente.estado.motivo === "manual" &&
            cliente.estado.razon && (
              <p className="text-xs text-text-3">Motivo registrado: {cliente.estado.razon}</p>
            )}
        </Bloque>
      </div>

      <Bloque
        titulo="Enlace de acceso"
        ayuda="Para que el dueño elija una contraseña nueva. Sirve una vez, caduca a los 7 días e invalida el anterior."
      >
        <form action={accionEnlace}>
          <input type="hidden" name="organizationId" value={cliente.id} />
          <Button type="submit" size="sm" variant="outline" disabled={enlaceEnCurso}>
            <Link2 className="mr-1.5 h-4 w-4" strokeWidth={2} />
            {enlaceEnCurso ? "Generando…" : "Generar enlace"}
          </Button>
        </form>
        {enlace.aviso && <EnlaceDeAcceso url={enlace.aviso} motivo="recuperacion" />}
      </Bloque>

      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}

function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cl-superficie space-y-2.5 rounded-lg border border-line p-3.5">
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <p className="mt-0.5 text-xs leading-snug text-text-3">{ayuda}</p>
      </div>
      {children}
    </section>
  );
}

function Insignia({ estado }: { estado: EstadoOrganizacion }) {
  const base = "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium";
  if (estado.estado === "activa") {
    return <span className={`${base} bg-success-tint text-success-text`}>Activa</span>;
  }
  if (estado.estado === "gracia") {
    return (
      <span className={`${base} bg-warning-tint text-warning-text`}>
        Vencida ·{" "}
        {estado.diasRestantes === 0
          ? "último día"
          : `${estado.diasRestantes} ${estado.diasRestantes === 1 ? "día" : "días"}`}
      </span>
    );
  }
  return (
    <span className={`${base} bg-danger-tint text-danger-text`}>
      Suspendida · {estado.motivo === "impago" ? "impago" : "manual"}
    </span>
  );
}

/**
 * El enlace, para copiar y mandar.
 *
 * `navigator.clipboard` solo existe en contexto seguro (HTTPS o localhost): en
 * desarrollo se entra por `http://algo.lvh.me:3000` y ahí no lo hay. Sin
 * alternativa, el botón no hacía nada y parecía roto — y solo fallaba en local,
 * que es como se arreglan tarde las cosas.
 */
function EnlaceDeAcceso({
  url,
  motivo,
}: {
  url: string;
  motivo: "alta" | "recuperacion";
}) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2500);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sin portapapeles");
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setManual(true);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-soft bg-brand-tint p-3">
      <p className="text-xs font-semibold text-brand-text">
        {motivo === "alta"
          ? "Cliente creado. Mandale este enlace:"
          : "Mandale este enlace al dueño:"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded bg-raised px-2 py-1.5 text-[11px]">
          {url}
        </code>
        <Button type="button" size="sm" onClick={() => void copiar()}>
          {copiado ? (
            <>
              <Check className="mr-1.5 h-4 w-4" strokeWidth={2.4} />
              Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" strokeWidth={2} />
              Copiar
            </>
          )}
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-text-3">
        Sirve una sola vez y caduca a los 7 días, así que da igual el canal por el que se
        lo mandes. El cliente elige su contraseña: nadie más la conoce.
      </p>
      {manual && (
        <p className="text-[11px] text-text-3">
          Este navegador no deja copiar solo sin conexión cifrada. Tocá el enlace para
          seleccionarlo y copialo con Cmd+C. En producción el botón funciona.
        </p>
      )}
    </div>
  );
}
