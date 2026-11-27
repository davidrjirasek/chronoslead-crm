/**
 * 157 — El recuperador, desde la línea de órdenes (ver `server/attribution/recuperar.ts`).
 *
 * En producción NO sirve: la base no se expone a internet. Ahí se usa el botón
 * del panel de superadmin, que corre el mismo módulo desde dentro. Esto queda
 * para desarrollo y para una base a la que sí se llegue.
 *
 *   ORG_SLUG=colegio-cerritos pnpm recuperar-anuncios          # solo mirar
 *   ORG_SLUG=colegio-cerritos APLICAR=1 pnpm recuperar-anuncios
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { recuperarAnunciosDeOrganizacion } from "@/server/attribution/recuperar";

const slug = process.env.ORG_SLUG?.trim();
const aplicar = process.env.APLICAR === "1";
if (!slug) {
  console.error("Falta ORG_SLUG. Uso:\n  ORG_SLUG=colegio-cerritos pnpm recuperar-anuncios");
  process.exit(1);
}

const [org] = await getDb()
  .select({ id: schema.organization.id, name: schema.organization.name })
  .from(schema.organization)
  .where(eq(schema.organization.slug, slug))
  .limit(1);
if (!org) { console.error(`No existe la organización «${slug}».`); process.exit(1); }

console.log(`${org.name} — ${aplicar ? "APLICANDO" : "solo mirando"}`);
const r = await recuperarAnunciosDeOrganizacion(org.id, { aplicar });
console.log(`  conversaciones miradas: ${r.miradas}`);
console.log(`  con anuncio en Zernio:  ${r.conAnuncio}`);
console.log(`  sin contacto en el CRM: ${r.sinContacto}`);
console.log(`  ${aplicar ? "atadas" : "se atarían"}: ${aplicar ? r.atadas : r.conAnuncio - r.sinContacto}`);
if (r.truncado) console.log("  (se alcanzó el tope de páginas: volvé a correrlo)");
process.exit(0);
