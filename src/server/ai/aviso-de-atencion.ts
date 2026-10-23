/**
 * 117 — Avisar a una persona cuando una conversación la necesita.
 *
 * El CRM ya marcaba la escalada en la bandeja, pero si nadie miraba la
 * pantalla el cliente esperaba. Las escaladas que más valen son justo las de
 * fuera de hora: un director preguntando por el servicio es un contrato
 * entero.
 *
 * Este módulo tiene DOS mitades a propósito. Arriba, decisiones puras que se
 * prueban sin levantar nada. Abajo, el envío, que compone piezas que ya
 * existen (contacto → conversación → plantilla) y **jamás lanza**: que el
 * aviso falle no puede tumbar la conversación del cliente.
 */

/** La plantilla aprobada en Meta. Sin ella, no hay aviso. */
export const PLANTILLA_DE_AVISO = "aviso_atencion_humana";

export type MotivoTecnico =
  | "cliente"
  | "modelo"
  | "error"
  | "ventana"
  | "hostilidad"
  | "manual_reply";

/**
 * Cómo se lee el motivo técnico cuando el modelo no dejó sus palabras.
 * Escrito para que lo lea una persona en el teléfono, no un programador.
 */
const EN_CASTELLANO: Record<MotivoTecnico, string> = {
  cliente: "el cliente pidió hablar con una persona",
  modelo: "el agente decidió escalar",
  error: "falló el proveedor de IA",
  ventana: "se cerró la ventana de 24 horas",
  hostilidad: "la conversación se puso hostil",
  manual_reply: "alguien respondió a mano",
};

/**
 * El {{4}} de la plantilla: POR QUÉ espera esta conversación.
 *
 * Las palabras del modelo ganan siempre que existan: dicen «quiere visitar la
 * propiedad», que es lo que la persona necesita saber para decidir si deja lo
 * que está haciendo. El motivo técnico es el respaldo.
 */
export function motivoDelAviso(
  motivo: MotivoTecnico | null,
  nota: string | null | undefined
): string {
  const palabras = nota?.trim();
  if (palabras) return palabras;
  if (motivo && motivo in EN_CASTELLANO) return EN_CASTELLANO[motivo];
  return "necesita atención humana";
}

/**
 * Si corresponde avisar. Cuatro puertas, y todas pueden cerrarse sin que sea
 * un error: una organización que no configuró destinatario simplemente no
 * manda avisos.
 */
export function hayQueAvisar(opts: {
  /** El destinatario configurado. Vacío = la función está apagada. */
  telefonoDestino: string | null | undefined;
  /** El Laboratorio jamás toca la API real, y un aviso es la API real. */
  esDePrueba: boolean;
  /** Solo el PASO a escalada avisa; no cada mensaje de una ya escalada. */
  yaEstabaEscalada: boolean;
}): boolean {
  if (!opts.telefonoDestino?.trim()) return false;
  if (opts.esDePrueba) return false;
  if (opts.yaEstabaEscalada) return false;
  return true;
}

/**
 * El {{3}}: la hora, en la zona del negocio y no en la del servidor.
 * Una hora mal puesta en un aviso urgente es peor que no ponerla.
 */
export function horaDelAviso(cuando: Date, zonaHoraria: string): string {
  try {
    return new Intl.DateTimeFormat("es", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: zonaHoraria,
    }).format(cuando);
  } catch {
    // Una zona inválida guardada en Ajustes no puede costar el aviso entero.
    return new Intl.DateTimeFormat("es", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(cuando);
  }
}

/**
 * Quién espera: nombre y, si se conoce, su teléfono.
 *
 * El teléfono va DENTRO del {{2}} y no en una variable nueva a propósito: la
 * plantilla ya está aprobada por Meta y agregarle un hueco la mandaría de
 * vuelta a revisión. Así el aviso se puede **reenviar** a alguien del equipo
 * que no entra a la plataforma, que es para lo que sirve.
 *
 * Sin teléfono —un contacto de Instagram o Messenger no tiene— va solo el
 * nombre: un paréntesis vacío se lee como un error.
 */
export function quienEspera(
  nombre: string,
  telefono: string | null | undefined
): string {
  const n = nombre.trim() || "un contacto";
  const t = telefono?.trim();
  return t ? `${n} (${t})` : n;
}

/** Las cuatro variables de la plantilla, en el orden que Meta espera. */
export function variablesDelAviso(opts: {
  nombreDestino: string | null | undefined;
  nombreDelContacto: string;
  telefonoDelContacto?: string | null;
  cuando: Date;
  zonaHoraria: string;
  motivo: MotivoTecnico | null;
  nota: string | null | undefined;
}): [string, string, string, string] {
  return [
    opts.nombreDestino?.trim() || "equipo",
    quienEspera(opts.nombreDelContacto, opts.telefonoDelContacto),
    horaDelAviso(opts.cuando, opts.zonaHoraria),
    motivoDelAviso(opts.motivo, opts.nota),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// El envío. Compone piezas que ya existen y JAMÁS lanza.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { scoped } from "@/lib/db/tenant";
import { normalizeMx } from "@/lib/meta/client";
import { getOrCreateContactByIdentity } from "@/server/inbox/identity";
import { getOrCreateConversation } from "@/server/inbox/ingest";
import { sendTemplate } from "@/server/whatsapp/templates";
import { DEFAULT_TIMEZONE } from "@/server/agenda/settings";

/**
 * Avisa por WhatsApp que una conversación necesita a una persona.
 *
 * **No lanza nunca.** Un aviso es un extra: si Meta rechaza, si la plantilla
 * se cayó o si el número está mal, se registra y se sigue. La conversación del
 * cliente no puede pagar el fallo de su propia notificación — la misma regla
 * que la agenda, que nunca tumba un turno porque un conector falló.
 */
export async function avisarAtencionHumana(opts: {
  organizationId: string;
  conversationId: string;
  motivo: MotivoTecnico | null;
  nota: string | null | undefined;
  /** Lo sabe quien llama: si ya había escalado, esto es un mensaje más. */
  yaEstabaEscalada: boolean;
}): Promise<void> {
  try {
    const db = getDb();

    const orgs = await db
      .select({
        alertPhone: schema.organization.alertPhone,
        alertName: schema.organization.alertName,
      })
      .from(schema.organization)
      .where(eq(schema.organization.id, opts.organizationId))
      .limit(1);
    const org = orgs[0];

    const convs = await db
      .select({
        isTest: schema.conversation.isTest,
        contactName: schema.contact.name,
        contactPhone: schema.contact.phone,
      })
      .from(schema.conversation)
      .innerJoin(
        schema.contact,
        eq(schema.contact.id, schema.conversation.contactId)
      )
      .where(
        scoped(
          schema.conversation.organizationId,
          opts.organizationId,
          eq(schema.conversation.id, opts.conversationId)
        )
      )
      .limit(1);
    const conv = convs[0];
    if (!conv) return;

    if (
      !hayQueAvisar({
        telefonoDestino: org?.alertPhone,
        esDePrueba: conv.isTest,
        yaEstabaEscalada: opts.yaEstabaEscalada,
      })
    ) {
      return;
    }

    // La plantilla tiene que estar APROBADA: `sendTemplate` lo exige igual, y
    // comprobarlo aquí evita una excepción por algo que no es un fallo.
    const plantillas = await db
      .select({ id: schema.template.id })
      .from(schema.template)
      .where(
        scoped(
          schema.template.organizationId,
          opts.organizationId,
          and(
            eq(schema.template.name, PLANTILLA_DE_AVISO),
            eq(schema.template.status, "approved")
          )!
        )
      )
      .limit(1);
    const plantilla = plantillas[0];
    if (!plantilla) {
      console.warn(
        `[aviso] ${opts.organizationId}: sin plantilla "${PLANTILLA_DE_AVISO}" aprobada; no se avisa`
      );
      return;
    }

    const zonas = await db
      .select({ timezone: schema.calendarSettings.timezone })
      .from(schema.calendarSettings)
      .where(eq(schema.calendarSettings.organizationId, opts.organizationId))
      .limit(1);
    const zonaHoraria = zonas[0]?.timezone ?? DEFAULT_TIMEZONE;

    // El destinatario es un contacto más del CRM: así el aviso queda en la
    // bandeja y se ve a quién se le avisó y cuándo.
    const telefono = normalizeMx(org!.alertPhone!.replace(/\D/g, ""));
    const destino = await getOrCreateContactByIdentity(opts.organizationId, {
      identity: telefono,
      phone: telefono,
      waUserId: null,
      profileName: org!.alertName?.trim() || null,
      channel: "whatsapp",
    });
    const conversacionDelAviso = await getOrCreateConversation(
      opts.organizationId,
      destino.contact.id
    );

    await sendTemplate({
      organizationId: opts.organizationId,
      conversationId: conversacionDelAviso.id,
      templateId: plantilla.id,
      variables: variablesDelAviso({
        nombreDestino: org!.alertName,
        nombreDelContacto: conv.contactName ?? "",
        telefonoDelContacto: conv.contactPhone,
        cuando: new Date(),
        zonaHoraria,
        motivo: opts.motivo,
        nota: opts.nota,
      }),
    });
  } catch (err) {
    console.error(
      `[aviso] no se pudo avisar de ${opts.conversationId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
