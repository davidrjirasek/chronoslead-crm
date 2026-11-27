/**
 * 157 — Recupera de Zernio el anuncio de las conversaciones que ya entraron.
 *
 * Por qué existe: hasta el 27-nov-2026 el CRM no estaba suscrito al evento
 * `conversation.started`, el único que trae el anuncio Click-to-WhatsApp, así
 * que las conversaciones de antes quedaron sin atribución. Meta no deja
 * reconstruirla —su `referral` viaja una sola vez, en el primer mensaje—,
 * pero Zernio sí la guarda en la conversación, y de ahí se puede traer.
 *
 * Vive en el servidor y no solo en un guion porque la base de producción no
 * se expone a internet (ni debe): la única forma de correrlo contra los datos
 * reales es desde dentro, con el botón del panel de superadmin.
 *
 * Es idempotente: `registrarAnuncioDeOrigen` no pisa un anuncio ya guardado
 * (UNIQUE de organización + conversación), así que correrlo dos veces no
 * duplica ni cambia lo que ya estaba.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { normalizeMx } from "@/lib/meta/client";
import { getZernioWhatsappByOrg } from "@/server/whatsapp/credentials";
import { zernioFetch } from "@/server/zernio";
import { anuncioDeWhatsapp, campanaDeZernio } from "@/server/attribution/referral";
import { registrarAnuncioDeConversacion } from "@/server/whatsapp/zernio-ingest";

/**
 * Tope de páginas: una cartera grande no puede colgar la petición del panel.
 *
 * Se pagina sobre TODO el espacio de trabajo —el endpoint no sabe filtrar por
 * cuenta— y se descarta lo ajeno al leerlo, así que el tope tiene que dar
 * para la cartera entera, no solo para un cliente. Al 27-nov eran unas 510
 * conversaciones entre los nueve; 40 páginas son 2.000.
 */
const MAX_PAGINAS = 40;
const POR_PAGINA = 50;

export type ResumenRecuperacion = {
  miradas: number;
  conAnuncio: number;
  atadas: number;
  sinContacto: number;
  truncado: boolean;
};

type ConvZernio = {
  /** De qué cuenta de Zernio es. Es lo que separa a un cliente de otro. */
  accountId?: string;
  participantId?: string;
  participantUsername?: string;
  metadata?: Record<string, unknown>;
  adAttribution?: unknown;
};

function telefono(crudo: string | null | undefined): string | null {
  if (!crudo) return null;
  const d = crudo.replace(/^\+/, "");
  return /^\d{6,}$/.test(d) ? normalizeMx(d) : null;
}

export async function recuperarAnunciosDeOrganizacion(
  organizationId: string,
  opciones: { aplicar: boolean } = { aplicar: true }
): Promise<ResumenRecuperacion> {
  const db = getDb();
  const cred = await getZernioWhatsappByOrg(organizationId);
  if (!cred?.token) {
    throw new Error("Este cliente no tiene conexión de Zernio guardada.");
  }
  /**
   * La cuenta de Zernio es lo ÚNICO que separa a un cliente de otro acá.
   *
   * La llave de API es del equipo, no de un cliente: `/inbox/conversations`
   * devuelve las de las 25 cuentas conectadas, o sea las de los nueve
   * clientes. Corriéndolo así el 27-nov sobre Colegio Cerritos se miraron 255
   * conversaciones ajenas y se le colgó un anuncio a las 47 que tenía,
   * orgánicas incluidas: bastaba que el teléfono existiera como contacto suyo.
   *
   * Sin cuenta no se puede distinguir, y entonces no se corre.
   */
  if (!cred.accountRef) {
    throw new Error("Este cliente no tiene cuenta de Zernio: no puedo saber cuáles son sus conversaciones.");
  }

  const r: ResumenRecuperacion = {
    miradas: 0, conAnuncio: 0, atadas: 0, sinContacto: 0, truncado: false,
  };

  let cursor: string | null = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const q = new URLSearchParams({
      platform: "whatsapp",
      limit: String(POR_PAGINA),
      accountId: cred.accountRef,
    });
    if (cursor) q.set("cursor", cursor);
    const res = (await zernioFetch(`/inbox/conversations?${q}`, {
      token: cred.token,
      timeoutMs: 20000,
    })) as { data?: ConvZernio[]; pagination?: { nextCursor?: string | null } };

    for (const c of res.data ?? []) {
      /**
       * El filtro que de verdad manda, y va acá y no en la consulta.
       *
       * `?accountId=` NO filtra en este endpoint: su documentación solo
       * contempla `profileId`, y todos los clientes de la agencia cuelgan del
       * MISMO perfil, así que tampoco serviría. Mandarlo y confiar fue el
       * segundo error del 27-nov: Zernio lo ignoró sin decir nada y la corrida
       * en seco volvió a informar 510 conversaciones de todos los clientes.
       *
       * Cada conversación trae su `accountId`, así que se descarta acá. Lo que
       * no se puede atribuir a la cuenta de ESTE cliente, no se mira.
       */
      if (c.accountId !== cred.accountRef) continue;

      r.miradas++;
      const meta = c.metadata;
      if (!meta || typeof meta !== "object") continue;
      const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
      if (!texto(meta.ctwa_clid) && !texto(meta.ctwa_source_id)) continue;

      const anuncio = anuncioDeWhatsapp({
        source_id: meta.ctwa_source_id,
        source_type: meta.ctwa_source_type,
        source_url: meta.ctwa_source_url,
        headline: meta.ctwa_headline,
        body: meta.ctwa_body,
        media_type: meta.ctwa_media_type,
        ctwa_clid: meta.ctwa_clid,
        // Zernio manda la miniatura con este nombre, no `ctwa_image_url`.
        image_url: meta.ctwa_image_url ?? meta.ctwa_thumbnail_url,
      });
      if (!anuncio) continue;
      anuncio.campana = campanaDeZernio(c.adAttribution);
      // Marca de origen: sin esto, una recuperación equivocada no se puede
      // deshacer sin borrar también lo que entró bien por el webhook.
      anuncio.raw = { ...anuncio.raw, recuperado_en: new Date().toISOString() };
      r.conAnuncio++;

      const identity = telefono(c.participantUsername || c.participantId);
      if (!identity) { r.sinContacto++; continue; }

      const [contacto] = await db
        .select({ id: schema.contact.id })
        .from(schema.contact)
        .where(and(
          eq(schema.contact.organizationId, organizationId),
          eq(schema.contact.waIdentity, identity)
        ))
        .limit(1);
      if (!contacto) { r.sinContacto++; continue; }

      if (opciones.aplicar) {
        // Sin reintento: acá la conversación existe o no existe, y esperar
        // no cambia nada. El reintento es para la carrera del webhook.
        await registrarAnuncioDeConversacion(organizationId, identity, anuncio, false);
        r.atadas++;
      }
    }

    cursor = res.pagination?.nextCursor ?? null;
    if (!cursor) return r;
  }
  r.truncado = true;
  return r;
}

/**
 * Borra SOLO lo que escribió una recuperación, por su marca en `raw`.
 *
 * Existe porque la primera versión de esto miraba el espacio de trabajo
 * entero y atribuyó de más. Lo que entró por el webhook no lleva la marca y
 * no se toca: es el dato bueno, el que Meta mandó en su momento.
 */
export async function deshacerRecuperacion(
  organizationId: string
): Promise<number> {
  const db = getDb();
  const borradas = await db
    .delete(schema.adAttribution)
    .where(
      and(
        eq(schema.adAttribution.organizationId, organizationId),
        sql`${schema.adAttribution.raw} ? 'recuperado_en'`
      )
    )
    .returning({ id: schema.adAttribution.id });
  return borradas.length;
}

/**
 * 157 — Rehace la atribución del cliente desde cero.
 *
 * Hace falta porque la primera recuperación —la que miraba el espacio de
 * trabajo entero— escribió SIN dejar marca: `deshacerRecuperacion` no la
 * encuentra, y no hay forma de separar sus filas de las buenas.
 *
 * Que borre todo suena peor de lo que es: nuestra tabla es una COPIA. El dato
 * original vive en la conversación de Zernio, así que lo que se borra se trae
 * de nuevo en el mismo paso. Por eso van juntos y no en dos botones: entre
 * uno y otro el cliente se quedaría sin atribución.
 *
 * Lo único que no vuelve es la copia local del creativo (`imageAssetId`), que
 * se baja aparte cuando el anuncio llega en vivo. La tarjeta sigue enseñando
 * la imagen, así que no se nota.
 */
export async function rehacerAtribucion(
  organizationId: string
): Promise<{ borradas: number; resumen: ResumenRecuperacion }> {
  const db = getDb();
  // Se comprueba la conexión ANTES de borrar: si Zernio no contesta, es
  // preferible quedarse con el dato sucio que sin ningún dato.
  const cred = await getZernioWhatsappByOrg(organizationId);
  if (!cred?.token || !cred.accountRef) {
    throw new Error(
      "Este cliente no tiene conexión de Zernio: no puedo rehacer nada."
    );
  }

  const borradas = await db
    .delete(schema.adAttribution)
    .where(eq(schema.adAttribution.organizationId, organizationId))
    .returning({ id: schema.adAttribution.id });

  const resumen = await recuperarAnunciosDeOrganizacion(organizationId, {
    aplicar: true,
  });
  return { borradas: borradas.length, resumen };
}
