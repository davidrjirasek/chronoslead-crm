/**
 * 106 — Generar un enlace de acceso para alguien que ya existe.
 *
 * Es el «olvidé mi contraseña» que Vocero nunca tuvo. Antes, la única salida
 * era reescribir el hash en la base a mano (`scripts/reset-password.mjs`).
 *
 *   ORG_ADMIN_EMAIL=dueno@suclinica.com pnpm acceso
 *
 * El enlace sirve UNA vez y caduca a los 7 días, así que da igual que viaje por
 * WhatsApp: uno viejo en un chat antiguo no abre nada. Al usarlo se cierran las
 * sesiones que siguieran abiertas con la contraseña anterior, que es lo que lo
 * hace útil cuando se sospecha de un acceso ajeno.
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { crearEnlace, urlDeEnlace } from "@/server/platform/access-link";

const DIRECTORIO = ".provision";

function fallar(mensaje: string): never {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const correo = (process.env.ORG_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!correo) {
    fallar("Falta el correo. Uso:\n  ORG_ADMIN_EMAIL=dueno@suclinica.com pnpm acceso");
  }

  const db = getDb();
  const filas = await db
    .select({
      userId: schema.user.id,
      organizationId: schema.member.organizationId,
      slug: schema.organization.slug,
      nombre: schema.organization.name,
    })
    .from(schema.user)
    .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.member.organizationId)
    )
    .where(eq(schema.user.email, correo))
    .limit(2);

  if (filas.length === 0) fallar(`No hay ninguna cuenta con el correo ${correo}.`);
  if (filas.length > 1) {
    fallar(
      `${correo} pertenece a más de una organización. Hoy el comando no sabe\n` +
        "  para cuál generarlo; pásalo a mano o quita la membresía sobrante."
    );
  }

  const fila = filas[0]!;
  const dominio = (process.env.BASE_DOMAIN ?? "").trim();

  const { token, expiraEn } = await crearEnlace({
    organizationId: fila.organizationId,
    userId: fila.userId,
    motivo: "recuperacion",
  });
  const enlace = urlDeEnlace(fila.slug, dominio, token, process.env.APP_BASE_URL ?? "");

  mkdirSync(DIRECTORIO, { recursive: true });
  const ruta = join(DIRECTORIO, `acceso-${fila.slug ?? fila.userId}.txt`);
  writeFileSync(
    ruta,
    [
      `organizacion: ${fila.nombre}`,
      `correo: ${correo}`,
      `enlace: ${enlace}`,
      `caduca: ${expiraEn.toISOString()}`,
      "",
      "Manda SOLO el enlace. Invalida cualquier enlace anterior de esta persona.",
      "",
    ].join("\n"),
    { mode: 0o600 }
  );
  chmodSync(ruta, 0o600);

  console.log(`\n✓ Enlace de acceso generado para ${correo} (${fila.nombre}).`);
  console.log(`  Escrito en: ${ruta}`);
  console.log("  El enlace anterior de esta persona, si lo había, ya no sirve.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
