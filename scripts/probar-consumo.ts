/**
 * 122 — Comprobación en vivo de que el consumo se anota.
 *
 * No es parte del producto ni del gate: es el guion con el que se verificó que
 * el camino completo escribe —proveedor → `usage` → tabla—, porque el examen
 * de aislamiento no ejercita ningún turno exitoso del agente.
 *
 *   OPENROUTER_BASE_URL=http://localhost:3000/api/dev/ai-mock \
 *   ORG_SLUG=sonrisa node --env-file=.env .tmp-consumo.mjs
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { chatJson } from "@/lib/ai";
import { getDb, schema } from "@/lib/db";

async function main() {
  const slug = process.env.ORG_SLUG;
  if (!slug) throw new Error("Falta ORG_SLUG");

  const db = getDb();
  const orgs = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1);
  const org = orgs[0];
  if (!org) throw new Error(`No existe la organización "${slug}"`);

  const antes = await db.select().from(schema.aiUsage);
  console.log(`filas antes: ${antes.length}`);

  const r = await chatJson(
    // Con FORZAR_FALLO el esquema no se cumple nunca: así se comprueba que
    // los tres intentos quedan anotados, no solo el último.
    process.env.FORZAR_FALLO
      ? z.object({ jamas_existe: z.literal("imposible") })
      : z.object({ action: z.string() }),
    [{ role: "user", content: "hola" }],
    { organizationId: org.id }
  );
  console.log(`turno: ${r.ok ? "ok" : `falló (${r.error})`}`);

  const despues = await db.select().from(schema.aiUsage);
  console.log(`filas después: ${despues.length}`);
  for (const f of despues.slice(antes.length)) {
    console.log(
      `  ${f.proposito} · ${f.resultado} · ${f.model} · ` +
        `${f.promptTokens}+${f.completionTokens}=${f.totalTokens} tokens`
    );
  }
  process.exit(despues.length > antes.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
