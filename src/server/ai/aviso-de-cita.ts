/**
 * 142 — Avisar al equipo lo que pasa con una cita.
 *
 * El 117 avisaba cuando una conversación necesitaba a una persona. Faltaba lo
 * de al lado, y se vio el 10-nov-2026 con una clienta real: el agente agendó
 * bien, la clienta pidió moverla, el agente contestó «le aviso ahora mismo a
 * nuestro equipo»… y nadie se enteró de nada. Ni de la cita original, porque
 * agendar nunca avisó, ni del cambio.
 *
 * Mismo patrón que el 117 y por las mismas razones: el destinatario es un
 * contacto más del CRM —así el aviso queda en la bandeja y se puede MIRAR
 * después—, y **jamás lanza**: que un aviso falle no puede tumbar la
 * conversación del cliente ni deshacer la cita, que ya está hecha.
 *
 * La parte de arriba son decisiones puras, probables sin levantar nada.
 */

/** Las tres plantillas, aprobadas en Meta. Sin ellas no hay aviso. */
export const PLANTILLAS_DE_CITA = {
  agendada: "cita_agendada_equipo",
  reprogramada: "cita_reprogramada_equipo",
  cancelada: "cita_cancelada_equipo",
} as const;

/**
 * 145 — La misma plantilla, con el enlace de la reunión adentro.
 *
 * El 17-nov-2026 el dueño preguntó si quien atiende recibía el enlace además
 * del día y la hora. No lo recibía: cuando se escribieron las plantillas
 * ninguna instancia tenía conector, así que no había enlace que poner. Con
 * Zoom conectado, Nathalia sabía CUÁNDO era la reunión pero no DÓNDE.
 *
 * Son plantillas aparte y no una edición de las otras por dos razones. Editar
 * una aprobada la manda de vuelta a revisión de Meta —con límite de una vez
 * cada 24 h— y durante ese rato el aviso queda en el aire. Y sobre todo:
 * **una instancia sin conector no tiene enlace que poner**, y Meta rechaza
 * una plantilla con una variable vacía. Con las dos versiones, cada
 * organización usa la que puede.
 */
export const PLANTILLAS_CON_ENLACE = {
  agendada: "cita_agendada_equipo_con_enlace",
} as const;

export type EventoDeCita = keyof typeof PLANTILLAS_DE_CITA;

/**
 * Si corresponde avisar. Tres puertas, y todas pueden cerrarse sin que sea un
 * error: una organización sin destinatario simplemente no manda avisos.
 */
export function hayQueAvisarDeCita(opts: {
  telefonoDestino: string | null | undefined;
  /** El Laboratorio jamás toca la API real, y un aviso es la API real. */
  esDePrueba: boolean;
}): boolean {
  if (!opts.telefonoDestino?.trim()) return false;
  if (opts.esDePrueba) return false;
  return true;
}

/**
 * El teléfono del cliente va en TODOS los avisos al equipo, por decisión del
 * dueño (10-nov-2026): «por si algo falle, no puede entrar a la plataforma o
 * algo así, o le pueda llamar directo». Sin teléfono —un contacto de
 * Instagram no tiene— va una frase honesta en vez de un hueco vacío.
 */
export function telefonoDelAviso(telefono: string | null | undefined): string {
  const t = telefono?.trim();
  return t || "no registrado";
}

export function nombreDelContacto(nombre: string | null | undefined): string {
  return nombre?.trim() || "un contacto";
}

/**
 * Las variables de cada plantilla, en el orden exacto en que Meta las espera.
 * Cambiar este orden manda el aviso con los datos cruzados, y Meta no avisa.
 */
export function variablesDeCita(opts: {
  evento: EventoDeCita;
  nombreDestino: string | null | undefined;
  nombreDelContacto: string | null | undefined;
  telefonoDelContacto: string | null | undefined;
  /** Etiqueta del horario: «jue 12 nov, 10:00». */
  cuando: string;
  /** Solo en `reprogramada`: dónde estaba antes. */
  cuandoAntes?: string;
  /** 145 — El enlace de la reunión, cuando la plantilla lo lleva. */
  enlace?: string | null;
}): string[] {
  const destino = opts.nombreDestino?.trim() || "equipo";
  const quien = nombreDelContacto(opts.nombreDelContacto);
  const tel = telefonoDelAviso(opts.telefonoDelContacto);

  // 145 — «… para el {{3}}. Enlace de la reunión: {{4}}. Su teléfono es
  //  {{5}} …». El enlace va ANTES del teléfono: es lo que la persona
  //  necesita primero para entrar a la reunión.
  if (opts.evento === "agendada" && opts.enlace?.trim()) {
    return [destino, quien, opts.cuando, opts.enlace.trim(), tel];
  }

  if (opts.evento === "reprogramada") {
    // «Hola {{1}}: se reprogramó la cita con {{2}}. Era el {{3}} y pasó al
    //  {{4}}. Su teléfono es {{5}}, por si necesitás comunicarte.»
    return [destino, quien, opts.cuandoAntes ?? "—", opts.cuando, tel];
  }
  // agendada:  «… para el {{3}}. Su teléfono es {{4}} …»
  // cancelada: «… que era el {{3}}. Su teléfono es {{4}} …»
  return [destino, quien, opts.cuando, tel];
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

/**
 * 145 — Busca una plantilla aprobada por nombre. Null si no está, para que
 * quien llama pueda probar la siguiente en vez de quedarse sin aviso.
 */
async function plantillaAprobada(
  organizationId: string,
  nombre: string
): Promise<{ id: string; name: string } | null> {
  const db = getDb();
  const filas = await db
    .select({ id: schema.template.id, name: schema.template.name })
    .from(schema.template)
    .where(
      scoped(
        schema.template.organizationId,
        organizationId,
        and(
          eq(schema.template.name, nombre),
          eq(schema.template.status, "approved")
        )!
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

export async function avisarDeCita(opts: {
  organizationId: string;
  /** La conversación del CLIENTE: de ella salen nombre, teléfono y si es de prueba. */
  conversationId: string;
  evento: EventoDeCita;
  cuando: string;
  cuandoAntes?: string;
  /** 145 — El enlace de la reunión, si la cita lo tiene. */
  enlace?: string | null;
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
      !hayQueAvisarDeCita({
        telefonoDestino: org?.alertPhone,
        esDePrueba: conv.isTest,
      })
    ) {
      return;
    }

    // 145 — Con enlace si lo hay Y la plantilla está aprobada; si no, la de
    // siempre. Así el despliegue no tiene que esperar a que Meta revise: el
    // día que apruebe, el aviso empieza a llevar el enlace solo.
    const conEnlace =
      opts.enlace?.trim() &&
      opts.evento in PLANTILLAS_CON_ENLACE
        ? PLANTILLAS_CON_ENLACE[opts.evento as keyof typeof PLANTILLAS_CON_ENLACE]
        : null;

    const plantilla = conEnlace
      ? (await plantillaAprobada(opts.organizationId, conEnlace)) ??
        (await plantillaAprobada(
          opts.organizationId,
          PLANTILLAS_DE_CITA[opts.evento]
        ))
      : await plantillaAprobada(
          opts.organizationId,
          PLANTILLAS_DE_CITA[opts.evento]
        );

    if (!plantilla) {
      console.warn(
        `[aviso-cita] ${opts.organizationId}: sin plantilla aprobada para "${opts.evento}"; no se avisa`
      );
      return;
    }
    const llevaEnlace = plantilla.name === conEnlace;

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
      variables: variablesDeCita({
        evento: opts.evento,
        nombreDestino: org!.alertName,
        nombreDelContacto: conv.contactName,
        telefonoDelContacto: conv.contactPhone,
        cuando: opts.cuando,
        cuandoAntes: opts.cuandoAntes,
        enlace: llevaEnlace ? opts.enlace : null,
      }),
    });
  } catch (err) {
    console.error(
      `[aviso-cita] no se pudo avisar de ${opts.conversationId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * 142 — Traduce un turno de agenda en el aviso que le toca al equipo.
 *
 * Vive aquí y no en el pipeline para que el pipeline siga sin aprender de
 * agendas: recibe qué acción se ejecutó y el turno que devolvió el motor, y
 * decide si hay algo que avisar y con qué plantilla.
 *
 * `offer_slots` no avisa: ofrecer horarios no es un hecho, es una propuesta.
 */
export async function avisoDelTurnoDeAgenda(opts: {
  organizationId: string;
  conversationId: string;
  accion: "offer_slots" | "book_slot" | "reschedule_slot" | "cancel_slot";
  turn: { ok: boolean; label?: string; enlace?: string | null };
  /** El horario que tenía la cita antes de moverla. */
  anterior: string | null;
}): Promise<void> {
  if (!opts.turn.ok) return;
  if (opts.accion === "offer_slots") return;

  const evento: EventoDeCita =
    opts.accion === "book_slot"
      ? "agendada"
      : opts.accion === "reschedule_slot"
        ? "reprogramada"
        : "cancelada";

  // Sin etiqueta no hay aviso que valga: «se agendó una cita» sin decir cuándo
  // obliga al equipo a entrar a buscarla, que es justo lo que el aviso evita.
  const cuando = opts.turn.label?.trim();
  if (!cuando) {
    console.warn(
      `[aviso-cita] ${opts.organizationId}: turno sin etiqueta en ${opts.accion}; no se avisa`
    );
    return;
  }

  await avisarDeCita({
    organizationId: opts.organizationId,
    conversationId: opts.conversationId,
    evento,
    cuando,
    cuandoAntes: opts.anterior ?? undefined,
    enlace: opts.turn.enlace ?? null,
  });
}
