import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { labelInTz } from "@/lib/time/slots";
import { getSettings } from "@/server/agenda/settings";
import { agendaEnabled } from "@/server/agenda/flag";
import {
  PLANTILLA_RECORDATORIO_CLIENTE,
  recordarAlCliente,
  recordarAlEquipo,
} from "@/server/ai/recordatorio-de-cita";

/**
 * 142 — Los recordatorios del día de la cita.
 *
 * Es la primera pieza del producto que la dispara **el reloj** y no una
 * conversación. Hasta aquí todo el trabajo de fondo nacía de un mensaje que
 * entraba; un recordatorio no tiene a nadie que lo provoque.
 *
 * Sigue el patrón del worker de despacho (`dispatch/worker.ts`): dentro del
 * proceso, sin colas externas (constitución II). Lo que lo hace fiable no es
 * el proceso sino la MARCA en la base: si el contenedor se reinicia a mitad,
 * la siguiente vuelta ve qué salió y qué no. Y si corrieran dos réplicas, la
 * marca se escribe ANTES de enviar, así que la segunda no duplica.
 *
 * El dueño eligió **una hora antes** (10-nov-2026), no una hora fija de la
 * mañana.
 */

/** Cuánto antes de la cita sale el recordatorio. */
export const ANTELACION_MS = 60 * 60 * 1000;
/** Cada cuánto barre. Fino para una antelación de una hora, y barato. */
const INTERVALO_MS = 5 * 60 * 1000;
/** Tope por vuelta: un pico de citas no puede comerse el proceso. */
const POR_TANDA = 25;

type Estado = { timer: NodeJS.Timeout | null; corriendo: boolean };

// En globalThis porque en dev los módulos se evalúan más de una vez y dos
// temporizadores sobre la misma tabla se pisarían.
const globalForRecordatorios = globalThis as unknown as {
  __chronosRecordatorios?: Estado;
};

function estado(): Estado {
  if (!globalForRecordatorios.__chronosRecordatorios) {
    globalForRecordatorios.__chronosRecordatorios = {
      timer: null,
      corriendo: false,
    };
  }
  return globalForRecordatorios.__chronosRecordatorios;
}

export function iniciarRecordatorios(): void {
  if (!agendaEnabled()) return;
  const e = estado();
  if (e.timer) return;
  e.timer = setInterval(() => void tandaDeRecordatorios(), INTERVALO_MS);
  // `unref` para que el temporizador no impida que el proceso termine.
  e.timer.unref?.();
  // Una vuelta al arrancar: tras un reinicio puede haber citas ya dentro de
  // la ventana, y esperar cinco minutos sería perderlas.
  void tandaDeRecordatorios();
}

export function detenerRecordatorios(): void {
  const e = estado();
  if (e.timer) clearInterval(e.timer);
  e.timer = null;
}

/**
 * Qué citas toca recordar AHORA. Pura sobre la base: devuelve las que entran
 * en la ventana y a las que todavía no se les mandó el recordatorio.
 *
 * `gt(scheduledAt, ahora)` importa: una cita que ya pasó no se recuerda. Sin
 * ese filtro, un reinicio después de un corte largo mandaría recordatorios de
 * citas de ayer.
 */
export async function citasPorRecordar(
  ahora: Date = new Date(),
  limite = POR_TANDA
) {
  const db = getDb();
  const limiteSuperior = new Date(ahora.getTime() + ANTELACION_MS);

  return db
    .select({
      id: schema.booking.id,
      organizationId: schema.booking.organizationId,
      conversationId: schema.booking.conversationId,
      contactId: schema.booking.contactId,
      scheduledAt: schema.booking.scheduledAt,
      reminderTeamAt: schema.booking.reminderTeamAt,
      reminderClientAt: schema.booking.reminderClientAt,
    })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.kind, "session"),
        eq(schema.booking.status, "agendada"),
        // El Laboratorio jamás toca la API real, y un recordatorio es la API
        // real.
        eq(schema.booking.isTest, false),
        gt(schema.booking.scheduledAt, ahora),
        lte(schema.booking.scheduledAt, limiteSuperior),
        // Con que falte uno de los dos, la cita entra en la tanda.
        or(
          isNull(schema.booking.reminderTeamAt),
          isNull(schema.booking.reminderClientAt)
        )
      )
    )
    .limit(limite);
}

export async function tandaDeRecordatorios(
  ahora: Date = new Date()
): Promise<number> {
  const e = estado();
  if (e.corriendo) return 0;
  e.corriendo = true;
  let mandados = 0;
  try {
    const db = getDb();
    const pendientes = await citasPorRecordar(ahora);

    for (const cita of pendientes) {
      if (cita.reminderTeamAt && cita.reminderClientAt) continue;

      const settings = await getSettings(cita.organizationId);
      const etiqueta = labelInTz(
        cita.scheduledAt.toISOString(),
        settings.timezone
      );
      const hora = horaEnZona(cita.scheduledAt, settings.timezone);

      // La marca va ANTES del envío: si el proceso muere entre marcar y
      // enviar se pierde UN recordatorio; si fuera al revés, un reinicio
      // repetiría el mensaje al cliente. Molestar dos veces a alguien es peor
      // que no avisarle, y el equipo tiene la cita en la agenda igual.
      if (!cita.reminderTeamAt && cita.conversationId) {
        await db
          .update(schema.booking)
          .set({ reminderTeamAt: new Date() })
          .where(eq(schema.booking.id, cita.id));
        await recordarAlEquipo({
          organizationId: cita.organizationId,
          conversationId: cita.conversationId,
          hora,
          etiqueta,
        });
        mandados += 1;
      }

      if (!cita.reminderClientAt && cita.conversationId) {
        await db
          .update(schema.booking)
          .set({ reminderClientAt: new Date() })
          .where(eq(schema.booking.id, cita.id));
        await recordarAlCliente({
          organizationId: cita.organizationId,
          conversationId: cita.conversationId,
          hora,
        });
        mandados += 1;
      }
    }
  } catch (err) {
    // Un fallo del barrido no puede tumbar el proceso: la siguiente vuelta
    // vuelve a intentarlo con lo que quedó sin marcar.
    console.error(`[recordatorios] la tanda falló: ${err}`);
  } finally {
    e.corriendo = false;
  }
  return mandados;
}

/** La hora de la cita, en la zona del negocio y no en la del servidor. */
export function horaEnZona(cuando: Date, zonaHoraria: string): string {
  try {
    return new Intl.DateTimeFormat("es", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: zonaHoraria,
    }).format(cuando);
  } catch {
    return new Intl.DateTimeFormat("es", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(cuando);
  }
}

export { PLANTILLA_RECORDATORIO_CLIENTE };
