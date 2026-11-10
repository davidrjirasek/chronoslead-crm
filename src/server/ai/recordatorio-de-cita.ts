/**
 * 142 — Los dos recordatorios del día de la cita.
 *
 * Son dos destinatarios distintos y por eso dos funciones: al EQUIPO se le
 * avisa en su propia conversación del CRM —la misma donde ya le llegan los
 * avisos de atención humana—, y al CLIENTE se le escribe en la suya.
 *
 * Los dos van por plantilla, y no es una preferencia: un recordatorio sale
 * una hora antes de la cita, y la conversación donde se agendó pudo haber
 * sido hace días. Fuera de la ventana de 24 h de WhatsApp, lo único que entra
 * es una plantilla aprobada.
 *
 * Como el 117 y el aviso de cita: componen piezas que ya existen y JAMÁS
 * lanzan. Que un recordatorio falle no puede tumbar nada — la cita sigue en
 * pie y el barrido ya marcó que lo intentó.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { scoped } from "@/lib/db/tenant";
import { normalizeMx } from "@/lib/meta/client";
import { getOrCreateContactByIdentity } from "@/server/inbox/identity";
import { getOrCreateConversation } from "@/server/inbox/ingest";
import { sendTemplate } from "@/server/whatsapp/templates";
import {
  hayQueAvisarDeCita,
  nombreDelContacto,
  telefonoDelAviso,
} from "@/server/ai/aviso-de-cita";

export const PLANTILLA_RECORDATORIO_EQUIPO = "cita_recordatorio_equipo";
export const PLANTILLA_RECORDATORIO_CLIENTE = "cita_recordatorio_cliente";

/** Busca una plantilla aprobada; null si no está (y lo deja dicho en el log). */
async function plantillaAprobada(
  organizationId: string,
  nombre: string
): Promise<string | null> {
  const db = getDb();
  const filas = await db
    .select({ id: schema.template.id })
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
  const fila = filas[0];
  if (!fila) {
    console.warn(
      `[recordatorio] ${organizationId}: sin plantilla "${nombre}" aprobada; no se recuerda`
    );
    return null;
  }
  return fila.id;
}

/** Contexto del cliente: nombre, teléfono y si la conversación es de prueba. */
async function contextoDeLaConversacion(
  organizationId: string,
  conversationId: string
) {
  const db = getDb();
  const filas = await db
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
        organizationId,
        eq(schema.conversation.id, conversationId)
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

/**
 * «Hola {{1}}: hoy tenés una cita con {{2}} a las {{3}}. Su teléfono es
 *  {{4}}, por si necesitás comunicarte.»
 */
export async function recordarAlEquipo(opts: {
  organizationId: string;
  /** La conversación del CLIENTE: de ella salen nombre y teléfono. */
  conversationId: string;
  hora: string;
  /** La etiqueta completa, solo para el log cuando algo sale mal. */
  etiqueta?: string;
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

    const conv = await contextoDeLaConversacion(
      opts.organizationId,
      opts.conversationId
    );
    if (!conv) return;
    if (
      !hayQueAvisarDeCita({
        telefonoDestino: org?.alertPhone,
        esDePrueba: conv.isTest,
      })
    ) {
      return;
    }

    const plantillaId = await plantillaAprobada(
      opts.organizationId,
      PLANTILLA_RECORDATORIO_EQUIPO
    );
    if (!plantillaId) return;

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
      templateId: plantillaId,
      variables: [
        org!.alertName?.trim() || "equipo",
        nombreDelContacto(conv.contactName),
        opts.hora,
        telefonoDelAviso(conv.contactPhone),
      ],
    });
  } catch (err) {
    console.error(
      `[recordatorio] el equipo no recibió el de ${opts.conversationId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * «Hola {{1}}, te recordamos tu cita de hoy a las {{2}} con {{3}}. Si
 *  necesitás moverla, respondé este mensaje y lo vemos.»
 *
 * El {{3}} es el nombre del negocio, que sale de la marca de la organización:
 * por eso la misma plantilla sirve para los nueve clientes.
 */
export async function recordarAlCliente(opts: {
  organizationId: string;
  conversationId: string;
  hora: string;
}): Promise<void> {
  try {
    const db = getDb();
    const conv = await contextoDeLaConversacion(
      opts.organizationId,
      opts.conversationId
    );
    if (!conv) return;
    // El Laboratorio jamás toca la API real.
    if (conv.isTest) return;

    const orgs = await db
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, opts.organizationId))
      .limit(1);

    const nombre = nombreDePila(conv.contactName);
    if (!nombre) {
      console.warn(
        `[recordatorio] ${opts.conversationId}: el contacto no tiene nombre; no se le recuerda`
      );
      return;
    }

    const plantillaId = await plantillaAprobada(
      opts.organizationId,
      PLANTILLA_RECORDATORIO_CLIENTE
    );
    if (!plantillaId) return;

    await sendTemplate({
      organizationId: opts.organizationId,
      conversationId: opts.conversationId,
      templateId: plantillaId,
      variables: [nombre, opts.hora, orgs[0]?.name?.trim() || "nosotros"],
    });
  } catch (err) {
    console.error(
      `[recordatorio] el cliente no recibió el de ${opts.conversationId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Solo el primer nombre. «Hola Lucía Jazmín Franco, te recordamos…» suena a
 * carta de banco; «Hola Lucía» suena a la persona que la atendió.
 *
 * Devuelve null cuando no hay nombre, y entonces el recordatorio al cliente
 * NO sale: la plantilla empieza por «Hola {{1}},» y cualquier relleno la
 * arruina («Hola hola», «Hola un contacto»). El del equipo sí sale igual,
 * porque ahí el nombre del cliente va en medio de la frase y «un contacto» se
 * lee bien.
 */
export function nombreDePila(nombre: string | null | undefined): string | null {
  const limpio = nombre?.trim();
  if (!limpio) return null;
  return limpio.split(/\s+/)[0] ?? limpio;
}
