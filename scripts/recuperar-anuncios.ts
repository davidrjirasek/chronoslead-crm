/**
 * 144 — Recupera los anuncios de las conversaciones que ya entraron.
 *
 * Por qué hace falta: hasta el 27-nov-2026 el CRM no estaba suscrito al evento
 * `conversation.started` de Zernio, que es el único que trae el anuncio
 * Click-to-WhatsApp. Las conversaciones de ese periodo entraron sin atribución
 * y el dato NO se reconstruye desde Meta — pero Zernio sí lo guarda en sus
 * conversaciones, así que se puede traer de ahí.
 *
 *   ORG_SLUG=colegio-cerritos pnpm recuperar-anuncios          # ver qué haría
 *   ORG_SLUG=colegio-cerritos APLICAR=1 pnpm recuperar-anuncios
 *
 * Sin `APLICAR=1` no escribe nada: solo informa. Es idempotente —el primer
 * anuncio gana por el UNIQUE de (organización, conversación)— así que correrlo
 * dos veces no duplica ni pisa lo que ya hubiera.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getZernioWhatsappByOrg } from "@/server/whatsapp/credentials";
import { zernioFetch } from "@/server/zernio";
import { anuncioDeWhatsapp } from "@/server/attribution/referral";
import { registrarAnuncioDeConversacion } from "@/server/whatsapp/zernio-ingest";
import { normalizeMx } from "@/lib/meta/client";

function fallar(msg: string): never {
  console.error(msg);
  process.exit(1);
}

type Conv = {
  participantId?: string;
  participantUsername?: string;
  participantName?: string;
  metadata?: Record<string, unknown>;
};

function telefono(crudo: string | null | undefined): string | null {
  if (!crudo) return null;
  const d = crudo.replace(/^\+/, "");
  return /^\d{6,}$/.test(d) ? normalizeMx(d) : null;
}

async function main() {
  const slug = process.env.ORG_SLUG?.trim();
  const aplicar = process.env.APLICAR === "1";
  if (!slug) fallar("Falta ORG_SLUG. Uso:\n  ORG_SLUG=colegio-cerritos pnpm recuperar-anuncios");

  const db = getDb();
  const [org] = await db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1);
  if (!org) fallar(`No existe la organización «${slug}».`);

  const cred = await getZernioWhatsappByOrg(org.id);
  if (!cred?.token) fallar(`«${slug}» no tiene conexión de Zernio guardada.`);
  if (!cred.accountRef) fallar(`«${slug}» no tiene cuenta de Zernio.`);

  console.log(`${org.name} — ${aplicar ? "APLICANDO" : "solo mirando (sin APLICAR=1 no escribe)"}\n`);

  let cursor: string | null = null;
  let vistas = 0, conAnuncio = 0, atadas = 0, sinConversacion = 0;

  do {
    const q = new URLSearchParams({ platform: "whatsapp", limit: "50" });
    if (cursor) q.set("cursor", cursor);
    const res = (await zernioFetch(`/inbox/conversations?${q}`, {
      token: cred.token,
      timeoutMs: 20000,
    })) as { data?: Conv[]; pagination?: { nextCursor?: string | null } };

    for (const c of res.data ?? []) {
      vistas++;
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
        image_url: meta.ctwa_image_url ?? meta.ctwa_thumbnail_url,
      });
      if (!anuncio) continue;
      conAnuncio++;

      const identity = telefono(c.participantUsername || c.participantId);
      if (!identity) { sinConversacion++; continue; }

      const [contacto] = await db
        .select({ id: schema.contact.id })
        .from(schema.contact)
        .where(and(
          eq(schema.contact.organizationId, org.id),
          eq(schema.contact.waIdentity, identity)
        ))
        .limit(1);
      if (!contacto) { sinConversacion++; continue; }

      console.log(`  ${c.participantName ?? identity} → ${anuncio.headline ?? "(sin titular)"}`);
      if (aplicar) {
        await registrarAnuncioDeConversacion(org.id, identity, anuncio);
        atadas++;
      }
    }
    cursor = res.pagination?.nextCursor ?? null;
  } while (cursor);

  console.log(`\nConversaciones miradas: ${vistas}`);
  console.log(`Con anuncio en Zernio:  ${conAnuncio}`);
  console.log(`Sin contacto en el CRM: ${sinConversacion}`);
  console.log(aplicar ? `Atadas: ${atadas}` : `Se atarían: ${conAnuncio - sinConversacion}`);
  process.exit(0);
}

main().catch((e) => fallar(e instanceof Error ? e.message : String(e)));
