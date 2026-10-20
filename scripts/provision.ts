/**
 * 104 — Dar de alta la organización de un cliente.
 *
 * En plataforma no hay registro público ni autoservicio: las organizaciones las
 * crea el operador. Esto es ese comando.
 *
 *   ORG_SLUG=suclinica ORG_NAME="Clínica Sonrisa" \
 *   ORG_ADMIN_EMAIL=dueno@suclinica.com pnpm provision
 *
 * Crea organización, dueño, membresía, pipeline y perfil del agente — lo mismo
 * que sembraba el primer registro. Es **idempotente**: correrlo dos veces con
 * el mismo slug no duplica nada.
 *
 * La contraseña inicial se genera aquí y se escribe en `.provision/{slug}.txt`
 * con permisos 600. NO se imprime: lo que aparece en una terminal acaba en el
 * historial del shell, en una captura o en el log de una sesión compartida.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { SEED_STAGES } from "@/server/auth/on-signup";
import { resolveTenantFromHost } from "@/lib/tenant/host";

const DIRECTORIO = ".provision";

function fallar(mensaje: string): never {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

/**
 * El slug se valida con la MISMA función que resuelve el Host en runtime. Si
 * aquí pasara uno que allí no resuelve, el cliente tendría una organización a
 * la que nadie puede entrar.
 */
function validarSlug(slug: string): void {
  const resultado = resolveTenantFromHost(`${slug}.ejemplo.test`, "ejemplo.test");
  if (resultado.kind !== "tenant") {
    fallar(
      `El slug "${slug}" no sirve como subdominio.\n` +
        "  Debe tener de 3 a 30 caracteres: minúsculas, dígitos y guiones,\n" +
        "  sin guion al principio ni al final, y no puede ser una palabra\n" +
        "  reservada de la plataforma (api, admin, alta, www, app…)."
    );
  }
}

/** Legible al dictarla por teléfono: sin caracteres que se confundan. */
function generarContrasena(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function main(): Promise<void> {
  const slug = (process.env.ORG_SLUG ?? "").trim().toLowerCase();
  const nombre = (process.env.ORG_NAME ?? "").trim();
  const correo = (process.env.ORG_ADMIN_EMAIL ?? "").trim().toLowerCase();

  if (!slug || !nombre || !correo) {
    fallar(
      "Faltan datos. Uso:\n" +
        '  ORG_SLUG=suclinica ORG_NAME="Clínica Sonrisa" \\\n' +
        "  ORG_ADMIN_EMAIL=dueno@suclinica.com pnpm provision"
    );
  }
  validarSlug(slug);
  if (!correo.includes("@")) fallar(`"${correo}" no parece un correo.`);

  const db = getDb();

  const yaExiste = await db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1);
  if (yaExiste[0]) {
    console.log(
      `\n= La organización "${slug}" ya existe (${yaExiste[0].name}). No se tocó nada.\n`
    );
    return;
  }

  const usuarioExistente = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, correo))
    .limit(1);

  const contrasena = usuarioExistente[0] ? null : generarContrasena();
  const hash = contrasena ? await hashPassword(contrasena) : null;

  const orgId = newId("organization");
  const userId = usuarioExistente[0]?.id ?? `usr_${newId("member").slice(4)}`;

  await db.transaction(async (tx) => {
    await tx.insert(schema.organization).values({ id: orgId, name: nombre, slug });

    if (!usuarioExistente[0]) {
      await tx.insert(schema.user).values({
        id: userId,
        name: nombre,
        email: correo,
        emailVerified: false,
      });
      await tx.insert(schema.account).values({
        id: `acc_${newId("member").slice(4)}`,
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
      });
    }

    await tx.insert(schema.member).values({
      id: newId("member"),
      organizationId: orgId,
      userId,
      role: "owner",
    });
    await tx.insert(schema.pipelineStage).values(
      SEED_STAGES.map((s, i) => ({
        id: newId("stage"),
        organizationId: orgId,
        name: s.name,
        position: i,
        kind: s.kind,
      }))
    );
    await tx.insert(schema.agentProfile).values({
      id: newId("agentProfile"),
      organizationId: orgId,
    });
  });

  const dominio = (process.env.BASE_DOMAIN ?? "").trim();
  const url = dominio ? `https://${slug}.${dominio}` : `(slug: ${slug})`;

  console.log(`\n✓ Organización "${nombre}" creada.`);
  console.log(`  Entra en: ${url}`);
  console.log(`  Dueño:    ${correo}`);

  if (contrasena) {
    mkdirSync(DIRECTORIO, { recursive: true });
    const ruta = join(DIRECTORIO, `${slug}.txt`);
    writeFileSync(
      ruta,
      `organizacion: ${nombre}\nurl: ${url}\ncorreo: ${correo}\ncontrasena: ${contrasena}\n`,
      { mode: 0o600 }
    );
    chmodSync(ruta, 0o600);
    console.log(`  Contraseña inicial escrita en: ${ruta}`);
    console.log("  (no se imprime aquí a propósito; bórrala cuando la entregues)\n");
  } else {
    console.log("  Ese correo ya tenía cuenta: conserva su contraseña.\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
