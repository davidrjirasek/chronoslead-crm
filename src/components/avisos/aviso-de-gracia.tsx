import { CalendarClock } from "lucide-react";
import type { EstadoOrganizacion } from "@/lib/tenant/estado";

/**
 * 104 — La franja que dice que la cuenta venció y cuántos días quedan.
 *
 * Es el aviso que no puede fallar: no depende de un correo que rebota, de un
 * trabajo programado que no corrió ni de un proveedor caído. Su límite es
 * conocido y está asumido: **solo lo ve quien entra**. El aviso que llega
 * aunque no entre llega con el cobro automático.
 *
 * Sin descartar, por lo mismo que el aviso de IA: no es una novedad, es que el
 * servicio se va a cortar. Se va solo cuando se paga.
 */
export function AvisoDeGraciaBanner({ estado }: { estado?: EstadoOrganizacion }) {
  if (estado?.estado !== "gracia") return null;

  const { diasRestantes } = estado;
  const cuando =
    diasRestantes === 0
      ? "hoy es el último día"
      : diasRestantes === 1
        ? "queda 1 día"
        : `quedan ${diasRestantes} días`;

  return (
    <div
      role="status"
      data-aviso-gracia
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-warning-soft bg-warning-tint px-4 py-2.5 text-[13px] text-warning-text"
    >
      <CalendarClock className="h-4 w-4 shrink-0" strokeWidth={1.7} />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">Tu cuenta venció</strong> — {cuando}{" "}
        antes de que se suspenda el servicio. Tus datos no se borran en ningún
        caso.
      </span>
    </div>
  );
}
