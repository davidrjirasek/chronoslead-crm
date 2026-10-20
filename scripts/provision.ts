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
 * 106 — NO genera contraseña: entrega un enlace de un solo uso para que el
 * cliente elija la suya. Así nadie más la conoce, ni el operador, y el enlace
 * caduca a los 7 días aunque quede en un chat viejo.
 *
 * El enlace se escribe en `.provision/{slug}.txt` con permisos 600 y no se
 * imprime: lo que aparece en una terminal acaba en el historial del shell, en
 * una captura o en el log de una sesión compartida.
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { SEED_STAGES } from "@/server/auth/on-signup";
import { resolveTenantFromHost } from "@/lib/tenant/host";
import { crearEnlace, urlDeEnlace } from "@/server/platform/access-link";
import { directorioDeEntregas } from "@/server/platform/entregas";

const DIRECTORIO = directorioDeEntregas();

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

async function main(): Promise<void> {
  const slug = (process.env.ORG_SLUG ?? "").trim().toLowerCase();
  const nombre = (process.env.ORG_NAME ?? "").trim();
  const correo = (process.env.ORG_ADMIN_EMAIL ?? "").trim().toLowerCase();

  if (!slug || !nombre || !correo) {
    fallar(
      "Faltan datos. Uso:\n" +
        '  ORG_SLUG=suclinica ORG_NAME="Clínica Sonrisa" \\\n' +
        "  ORG_ADMIN_EMAIL=dueno@suclinica.com pnpm provision\n" +
        "\n" +
        "  En la terminal del contenedor, lo mismo sin pnpm:\n" +
        '  ORG_SLUG=suclinica ORG_NAME="Clínica Sonrisa" \\\n' +
        "  ORG_ADMIN_EMAIL=dueno@suclinica.com node provision.mjs"
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
      // Sin contraseña: la fija el cliente con el enlace. Una cuenta nace sin
      // llave y la primera llave la elige su dueño.
      await tx.insert(schema.account).values({
        id: `acc_${newId("member").slice(4)}`,
        accountId: userId,
        providerId: "credential",
        userId,
        password: null,
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
  const { token, expiraEn } = await crearEnlace({
    organizationId: orgId,
    userId,
    motivo: "alta",
  });
  const enlace = urlDeEnlace(slug, dominio, token, process.env.APP_BASE_URL ?? "");

  mkdirSync(DIRECTORIO, { recursive: true });
  const ruta = join(DIRECTORIO, `${slug}.txt`);
  writeFileSync(
    ruta,
    [
      `organizacion: ${nombre}`,
      `correo: ${correo}`,
      `enlace: ${enlace}`,
      `caduca: ${expiraEn.toISOString()}`,
      "",
      "Manda SOLO el enlace. Sirve una vez y caduca a los 7 dias.",
      "El cliente elige su propia contrasena: nadie mas la conoce.",
      "",
    ].join("\n"),
    { mode: 0o600 }
  );
  chmodSync(ruta, 0o600);

  console.log(`\n✓ Organización "${nombre}" creada.`);
  console.log(`  Dueño: ${correo}`);
  console.log(`  Enlace de primer acceso escrito en: ${ruta}`);
  console.log("  (no se imprime aquí; ábrelo, mándaselo al cliente y bórralo)\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
