"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Salir } from "@/components/admin/salir";
import { Check, ChevronDown, ClipboardList, Copy, FileText, Link2, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoOrganizacion } from "@/lib/tenant/estado";
import type { FilaDelPadron, MiembroDelPadron } from "@/server/platform/padron";
import type { SaludDeCliente } from "@/server/platform/salud";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  formatMoneyCents,
} from "@/lib/money";
import {
  altaDeCliente,
  enlaceDeAcceso,
  sumarSoporteACliente,
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
  salud,
  miembros,
}: {
  clientes: FilaDelPadron[];
  operador: string;
  /** 123 — Estado de cada dirección, por slug. Vacío = no se pudo consultar. */
  salud: Record<string, SaludDeCliente>;
  /** 136 — Los miembros de cada organización, por id, para elegir a quién. */
  miembros: Record<string, MiembroDelPadron[]>;
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
          <div className="flex items-center gap-3">
            {/* 128 — La salida del formulario de onboarding. Va acá porque es
                el paso 0 del alta: se mira ANTES de crear al cliente. */}
            <Link
              href="/admin/cuestionarios"
              className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3.5 text-sm font-medium text-text transition hover:bg-bg-hover"
            >
              <ClipboardList className="mr-1.5 h-4 w-4" strokeWidth={2} />
              Cuestionarios
            </Link>
            <Salir />
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
          </div>
        </header>

        {abierto && (
          // Tras crear con éxito el formulario NO se cierra: ahí está el enlace
          // que hay que copiar, y cerrarlo lo perdería.
          <form
            action={accionAlta}
            className="cl-superficie space-y-3 rounded-xl border border-line p-4 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                ayuda="El cliente. Queda como propietario de la cuenta."
              />
              <Campo
                id="correoSoporte"
                etiqueta="Correos de soporte"
                ejemplo="david@… , dan@… , sara@…"
                opcional
                ayuda="Quiénes van a configurar esta instancia. Uno o varios, separados por coma. Entran como administradores. A los que ya tengan cuenta no se les manda enlace: entran con su contraseña de siempre."
              />
            </div>
            {alta.error && <Aviso tono="error">{alta.error}</Aviso>}
            {alta.aviso && (
              <div className="space-y-2 rounded-lg border border-brand-soft bg-brand-tint/40 p-3">
                <p className="text-xs font-semibold text-brand-text">
                  Cliente creado. Mandale a cada uno lo suyo:
                </p>
                <MensajesParaCopiar texto={alta.aviso} />
                <p className="text-[11px] leading-snug text-text-3">
                  Los enlaces sirven una sola vez y caducan a los 7 días, así que
                  da igual el canal por el que los mandes. Cada persona elige su
                  contraseña: nadie más la conoce.
                </p>
              </div>
            )}
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
                  salud={c.slug ? salud[c.slug] : undefined}
                  abierto={expandido === c.id}
                  alternar={() => setExpandido((id) => (id === c.id ? null : c.id))}
                  miembros={miembros[c.id] ?? []}
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
  opcional = false,
}: {
  id: string;
  etiqueta: string;
  ejemplo: string;
  ayuda: string;
  tipo?: string;
  /** 121 — El correo de soporte es opcional aquí y obligatorio en el procedimiento. */
  opcional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={id} type={tipo} required={!opcional} placeholder={ejemplo} />
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
 * Suma por moneda. Nunca una sola cifra con monedas mezcladas: sumar pesos y
 * dólares da un número que no existe en ninguna contabilidad.
 */
function totalPorMoneda(pagos: FilaDelPadron["pagos"]): string {
  if (pagos.length === 0) return "—";
  const totales = new Map<string, number>();
  for (const p of pagos) {
    totales.set(p.moneda, (totales.get(p.moneda) ?? 0) + p.importeCentavos);
  }
  return [...totales.entries()]
    .map(([moneda, centavos]) => formatMoneyCents(centavos, moneda))
    .join(" · ");
}

/**
 * Una fila: lo que hay que saber de un vistazo y UN botón para actuar. En un
 * teléfono los datos se apilan en vez de salirse por la derecha.
 */
function Cliente({
  cliente,
  salud,
  abierto,
  alternar,
  miembros,
}: {
  cliente: FilaDelPadron;
  salud?: SaludDeCliente;
  abierto: boolean;
  alternar: () => void;
  miembros: MiembroDelPadron[];
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

        <div className="basis-36 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-text-4">Cobrado</p>
          {/* De un vistazo, sin abrir nada: lo que más se mira de un cliente. */}
          <p className={cliente.pagos.length ? "text-text-2" : "text-text-4"}>
            {totalPorMoneda(cliente.pagos)}
          </p>
        </div>

        <div className="basis-20 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-text-4">Usuarios</p>
          <p className="text-text-2">{cliente.usuarios}</p>
        </div>

        <Supervision cliente={cliente} salud={salud} />

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

      {abierto && <Acciones cliente={cliente} miembros={miembros} />}
    </li>
  );
}

/** El panel de acciones, a todo el ancho: aquí sí hay sitio para explicar. */
function Acciones({
  cliente,
  miembros,
}: {
  cliente: FilaDelPadron;
  miembros: MiembroDelPadron[];
}) {
  const [pago, accionPago, pagoEnCurso] = useActionState(marcarPago, SIN_RESULTADO);
  const [susp, accionSusp, suspEnCurso] = useActionState(suspenderCliente, SIN_RESULTADO);
  const [reac, accionReac, reacEnCurso] = useActionState(reactivarCliente, SIN_RESULTADO);
  const [soporte, accionSoporte, soporteEnCurso] = useActionState(
    sumarSoporteACliente,
    SIN_RESULTADO
  );
  const [enlace, accionEnlace, enlaceEnCurso] = useActionState(
    enlaceDeAcceso,
    SIN_RESULTADO
  );

  const suspendidoAMano =
    cliente.estado.estado === "suspendida" && cliente.estado.motivo === "manual";
  const error = pago.error ?? susp.error ?? reac.error ?? enlace.error ?? soporte.error;

  return (
    <div className="space-y-4 border-t border-line bg-brand-tint/50 px-4 py-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Bloque
          titulo="Registrar un cobro"
          ayuda="Queda en el histórico con su importe. El periodo arranca donde terminaba el anterior, así que un cliente que paga tarde no pierde esos días."
        >
          <form action={accionPago} className="space-y-2">
            <input type="hidden" name="organizationId" value={cliente.id} />
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`importe-${cliente.id}`} className="text-[11px]">
                  Importe
                </Label>
                <Input
                  id={`importe-${cliente.id}`}
                  name="importe"
                  required
                  inputMode="decimal"
                  placeholder="1500"
                  className="h-9 w-28"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`moneda-${cliente.id}`} className="text-[11px]">
                  Moneda
                </Label>
                <select
                  id={`moneda-${cliente.id}`}
                  name="moneda"
                  defaultValue={cliente.pagos[0]?.moneda ?? DEFAULT_CURRENCY}
                  className="h-9 rounded-md border border-border bg-raised px-2 text-sm"
                >
                  {CURRENCY_OPTIONS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`hasta-${cliente.id}`} className="text-[11px]">
                  Cubre hasta (opcional)
                </Label>
                <Input
                  id={`hasta-${cliente.id}`}
                  name="hasta"
                  type="date"
                  className="h-9 w-40"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`nota-${cliente.id}`} className="text-[11px]">
                  Nota (opcional)
                </Label>
                <Input
                  id={`nota-${cliente.id}`}
                  name="nota"
                  placeholder="transferencia, Mercado Pago…"
                  className="h-9 w-60"
                />
              </div>
              <Button type="submit" size="sm" disabled={pagoEnCurso}>
                {pagoEnCurso ? "Guardando…" : "Registrar cobro"}
              </Button>
            </div>
          </form>
          {/* Lo que pasó, no solo que el botón dejó de girar. */}
          {pago.aviso ? (
            <Aviso tono="ok">{pago.aviso}</Aviso>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-text-3">
              <Check
                className="h-3.5 w-3.5 shrink-0 text-success-text"
                strokeWidth={2.4}
              />
              {cliente.pagadoHasta
                ? `Ahora está pagado hasta el ${fecha.format(cliente.pagadoHasta)}.`
                : "Todavía sin ningún cobro registrado."}
            </p>
          )}
        </Bloque>

        {/* Los dos en la MISMA celda de la rejilla y apilados: sueltos, el
            tercer bloque caía otra vez a la izquierda y la columna derecha
            quedaba medio vacía. */}
        <div className="space-y-4">
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

        <Bloque
          titulo="Soporte de la agencia"
          ayuda="Suma gente nuestra como administradora de este cliente. Uno o varios correos, separados por coma. A quien ya tenga cuenta se la reutiliza: entra con su contraseña de siempre. Queda anotado en la bitácora que el cliente ve."
          accion={
            /* 136 — Desde adentro del cliente NO se puede: la regla de rangos
               impide que un administrador nombre administradores. Superadmin
               está por encima del propietario, así que acá sí corresponde. */
            <form action={accionSoporte} className="flex items-center gap-2">
              <input type="hidden" name="organizationId" value={cliente.id} />
              <input
                name="correos"
                required
                placeholder="correo, correo, correo"
                aria-label="Correos de soporte"
                className="h-8 w-[20rem] rounded-md border border-line bg-transparent px-2 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" disabled={soporteEnCurso}>
                <UserPlus className="mr-1.5 h-4 w-4" strokeWidth={2} />
                {soporteEnCurso ? "Sumando…" : "Sumar"}
              </Button>
            </form>
          }
        >
          {soporte.aviso ? <MensajesParaCopiar texto={soporte.aviso} /> : <span />}
        </Bloque>

        <Bloque
          titulo="Enlace de acceso"
          ayuda="Para elegir una contraseña nueva. Sirve una vez, caduca a los 7 días e invalida el anterior de esa persona. Por eso hay que elegir para quién."
          accion={
            /* 136 — A quién, por nombre. Antes eran dos botones por ROL, y con
               dos administradores `.limit(1)` sin `ORDER BY` devolvía uno
               indeterminado: se le podía romper el acceso a un compañero. Los
               miembros de Bandeja, además, no tenían forma de recibir uno. */
            miembros.length === 0 ? (
              <span className="text-xs text-text-3">
                Este cliente todavía no tiene usuarios.
              </span>
            ) : (
              <form action={accionEnlace} className="flex items-center gap-2">
                <input type="hidden" name="organizationId" value={cliente.id} />
                <select
                  name="memberId"
                  defaultValue=""
                  required
                  aria-label="A quién se le genera el enlace"
                  className="h-8 max-w-[18rem] rounded-md border border-line bg-transparent px-2 text-xs"
                >
                  <option value="" disabled>
                    Elegí a quién…
                  </option>
                  {miembros.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.correo} · {etiquetaDeRol(m.rol)}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline" disabled={enlaceEnCurso}>
                  <Link2 className="mr-1.5 h-4 w-4" strokeWidth={2} />
                  {enlaceEnCurso ? "Generando…" : "Generar"}
                </Button>
              </form>
            )
          }
        >
          {enlace.aviso ? (
            <EnlaceDeAcceso url={enlace.aviso} motivo="recuperacion" />
          ) : (
            <span />
          )}
        </Bloque>
        </div>
      </div>

      <Historico cliente={cliente} />

      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}

/** 109 — Los cobros de este cliente, y el enlace al extracto imprimible. */
function Historico({ cliente }: { cliente: FilaDelPadron }) {
  if (cliente.pagos.length === 0) {
    return (
      <Bloque
        titulo="Histórico de cobros"
        ayuda="Todavía no hay ninguno. El primero que registres aparece acá."
      >
        <span />
      </Bloque>
    );
  }

  // Un total por moneda: sumar pesos y dólares daría un número que no existe.
  const totales = new Map<string, number>();
  for (const p of cliente.pagos) {
    totales.set(p.moneda, (totales.get(p.moneda) ?? 0) + p.importeCentavos);
  }

  return (
    <Bloque
      titulo={`Histórico de cobros (${cliente.pagos.length})`}
      ayuda="Todo lo cobrado a este cliente, con el periodo que cubrió cada pago."
      accion={
        <div className="flex items-center gap-3">
          <p className="text-sm">
            <span className="text-text-3">Total: </span>
            {[...totales.entries()].map(([moneda, centavos], i) => (
              <span key={moneda} className="font-semibold tabular-nums">
                {i > 0 && " · "}
                {formatMoneyCents(centavos, moneda)}
              </span>
            ))}
          </p>
          <a
            href={`/admin/extracto/${cliente.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-hover"
          >
            <FileText className="h-4 w-4" strokeWidth={2} />
            Extracto
          </a>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-text-4">
            <tr>
              <th className="py-1 pr-3 font-medium">Cobrado</th>
              <th className="py-1 pr-3 font-medium">Cubre</th>
              <th className="py-1 pr-3 font-medium">Importe</th>
              <th className="py-1 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cliente.pagos.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5 pr-3 text-text-2">{fecha.format(p.cobradoEn)}</td>
                <td className="py-1.5 pr-3 text-text-3">
                  {fecha.format(p.cubreDesde)} — {fecha.format(p.cubreHasta)}
                </td>
                <td className="py-1.5 pr-3 font-medium tabular-nums">
                  {formatMoneyCents(p.importeCentavos, p.moneda)}
                </td>
                <td className="py-1.5 text-text-3">{p.nota ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </Bloque>
  );
}

function Bloque({
  titulo,
  ayuda,
  accion,
  children,
}: {
  titulo: string;
  ayuda: string;
  /** Va arriba a la derecha: lo que se busca no debería estar al final. */
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="cl-superficie space-y-2.5 rounded-lg border border-line p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{titulo}</h3>
          <p className="mt-0.5 text-xs leading-snug text-text-3">{ayuda}</p>
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

/**
 * 123 — Lo que hay que mirar de un cliente sin abrir nada.
 *
 * Cuatro señales, ordenadas por urgencia real. La primera es la que más vale:
 * una dirección que no responde significa, casi siempre, que al dar de alta se
 * olvidó agregar el dominio en Coolify — y hoy eso se descubre cuando el
 * cliente llama.
 *
 * Números agregados, nunca contenido: cuántas conversaciones esperan, no qué
 * dicen.
 */
function Supervision({
  cliente,
  salud,
}: {
  cliente: FilaDelPadron;
  salud?: SaludDeCliente;
}) {
  const s = cliente.supervision;
  return (
    <div className="flex basis-64 flex-wrap items-center gap-x-3 gap-y-1.5">
      <Senal
        rotulo="Dirección"
        tono={
          !salud
            ? "neutro"
            : salud.estado === "ok"
              ? "bien"
              : salud.estado === "sin_dominio"
                ? "mal"
                : "aviso"
        }
        valor={
          !salud
            ? "—"
            : salud.estado === "ok"
              ? "responde"
              : salud.estado === "sin_dominio"
                ? "falta en Coolify"
                : salud.estado === "sin_respuesta"
                  ? "sin respuesta"
                  : `código ${salud.codigo}`
        }
      />

      <Senal
        rotulo="Llave de IA"
        tono={
          s.estadoIa === null ? "neutro" : s.estadoIa === "active" ? "bien" : "mal"
        }
        valor={
          s.estadoIa === null
            ? "sin configurar"
            : s.estadoIa === "active"
              ? "activa"
              : s.estadoIa === "paused_no_credit"
                ? "sin crédito"
                : "rechazada"
        }
      />

      <Senal
        rotulo="Sin tomar"
        tono={s.esperandoPersona > 0 ? "aviso" : "bien"}
        valor={
          s.esperandoPersona === 0
            ? "ninguna"
            : `${s.esperandoPersona} ${s.esperandoPersona === 1 ? "conversación" : "conversaciones"}`
        }
      />

      <Senal
        rotulo="Tokens del mes"
        tono="neutro"
        valor={
          s.tokensDelMes === 0
            ? "sin uso"
            : s.tokensDesperdiciados > 0
              ? `${miles(s.tokensDelMes)} · ${miles(s.tokensDesperdiciados)} perdidos`
              : miles(s.tokensDelMes)
        }
      />

      <Senal
        rotulo="Último mensaje"
        tono={tonoPorAntiguedad(s.ultimaEntrante)}
        valor={desdeCuando(s.ultimaEntrante)}
      />
    </div>
  );
}

function Senal({
  rotulo,
  valor,
  tono,
}: {
  rotulo: string;
  valor: string;
  tono: "bien" | "aviso" | "mal" | "neutro";
}) {
  const color =
    tono === "bien"
      ? "text-success-text"
      : tono === "aviso"
        ? "text-warning-text"
        : tono === "mal"
          ? "text-danger-text"
          : "text-text-3";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-text-4">{rotulo}</p>
      <p className={`truncate text-xs font-medium ${color}`}>{valor}</p>
    </div>
  );
}

const miles = (n: number) => new Intl.NumberFormat("es-PY").format(n);

/**
 * Un cliente que hace días que no recibe un mensaje no está necesariamente
 * roto, pero es lo primero que hay que mirar: o se le cayó un canal, o no lo
 * está usando. Las dos cosas valen una llamada.
 */
function tonoPorAntiguedad(cuando: Date | null): "bien" | "aviso" | "neutro" {
  if (!cuando) return "neutro";
  const dias = (Date.now() - cuando.getTime()) / 86_400_000;
  return dias <= 3 ? "bien" : "aviso";
}

function desdeCuando(cuando: Date | null): string {
  if (!cuando) return "nunca";
  const horas = (Date.now() - cuando.getTime()) / 3_600_000;
  if (horas < 1) return "hace minutos";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
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

/** 136 — El rol como lo lee un humano, para el selector del enlace. */
function etiquetaDeRol(rol: string): string {
  if (rol === "owner") return "Propietario";
  if (rol === "admin") return "Administrador";
  return "Miembro";
}

/**
 * 136 — Un bloque por mensaje, cada uno con SU botón de copiar.
 *
 * Antes el resultado del alta salía entero en un solo bloque con un botón: para
 * mandarle a cada persona lo suyo había que editarlo a mano, y lo suyo suele ser
 * un enlace que fija su contraseña. Mandar el blob entero es repartir las llaves
 * de todos. Lo detectó el dueño creando los siete clientes.
 */
function MensajesParaCopiar({ texto }: { texto: string }) {
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length === 0) return <span />;
  return (
    <div className="space-y-2">
      {lineas.map((linea, i) => (
        <MensajeParaCopiar key={i} texto={linea} />
      ))}
    </div>
  );
}

function MensajeParaCopiar({ texto }: { texto: string }) {
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
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setManual(true);
    }
  }

  // Un enlace vivo merece más atención visual que un «ya tiene cuenta».
  const llevaEnlace = texto.includes("://");

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 ${
        llevaEnlace ? "border-brand-soft bg-brand-tint" : "border-line"
      }`}
    >
      <code className="min-w-0 flex-1 select-all break-all text-[11px] leading-snug">
        {texto}
      </code>
      <Button type="button" size="sm" variant={llevaEnlace ? "default" : "outline"} onClick={() => void copiar()}>
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
      {manual && (
        <p className="w-full text-[11px] text-text-3">
          Este navegador no deja copiar solo sin conexión cifrada. Tocá el texto
          para seleccionarlo y copialo con Cmd+C.
        </p>
      )}
    </div>
  );
}
