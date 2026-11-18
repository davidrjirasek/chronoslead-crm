/**
 * 146 — Las dos pantallas, con un navegador de verdad.
 *
 * Lo que prueba:
 *  - Ajustes → Agenda enseña «Quién atiende» con los dos directores, su
 *    criterio y sus destinatarios de aviso.
 *  - Citas enseña el filtro «Todos · Ana · Beto» y las dos citas de la
 *    MISMA hora, una de cada uno — lo que antes de esta spec era imposible.
 *  - Con el interruptor apagado, **ninguna de las dos cosas existe**. Esa es
 *    la comprobación que protege a los otros ocho clientes.
 *
 * Espera los datos que siembra el guion de preparación (ver la bitácora de la
 * 146). Uso: pnpm test:e2e:recursos:ui
 */
import { chromium } from "playwright";
import postgres from "postgres";

const SLUG = "e2erecursos";
const CORREO = "e2e-recursos@chronoslead.test";
const CONTRASENA = "contrasena-e2e-146";
const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "lvh.me";
const PUERTO = (process.env.APP_BASE_URL ?? "").match(/:(\d+)/)?.[1] ?? "3000";
const BASE = `http://${SLUG}.${BASE_DOMAIN}:${PUERTO}`;

let fallos = 0;
let checks = 0;
function ok(nombre, cond, extra = "") {
  checks++;
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}${extra ? ` — ${extra}` : ""}`);
  }
}

const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "es-PY",
});
const page = await ctx.newPage();

async function interruptor(encendido) {
  await sql`update organization set agenda_resources = ${encendido} where slug = ${SLUG}`;
}

/**
 * La app mantiene abierto el stream de eventos (SSE): `networkidle` no llega
 * nunca. Y las dos pantallas se pintan en el cliente después de consultar al
 * servidor, así que esperar un tiempo fijo da falsos rojos. Se espera por el
 * texto que tiene que estar.
 */
async function abrir(ruta, anclaje) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
  await page.getByText(anclaje).first().waitFor({ timeout: 20000 }).catch(() => {});
  return page.content();
}

try {
  // La sesión se abre por la API, como hacen los demás guiones del repo.
  const login = await ctx.request.post(`${BASE}/api/auth/sign-in/email`, {
    headers: { origin: BASE, "content-type": "application/json" },
    data: { email: CORREO, password: CONTRASENA },
    failOnStatusCode: false,
  });
  ok("la sesión queda abierta", login.status() === 200, `recibido ${login.status()}`);
  if (login.status() !== 200) throw new Error("sin sesión no hay nada que mirar");

  console.log("\n== Con el interruptor encendido ==");
  await interruptor(true);

  const ajustes = await abrir("/settings/calendar", "Quién atiende");
  ok("Ajustes → Agenda enseña «Quién atiende»", ajustes.includes("Quién atiende"));
  ok("con la directora", ajustes.includes("Ana Benítez"));
  ok("y el director", ajustes.includes("Beto Ruiz"));
  ok(
    "el criterio que lee el agente está a la vista",
    ajustes.includes("desde 4.º grado"),
    "no se ve el criterio"
  );
  ok(
    "y los destinatarios de aviso del recurso",
    ajustes.includes("595900000001") && ajustes.includes("595900000003"),
    "no se ven los avisos"
  );

  const citas = await abrir("/bookings?vista=semana", "Familia Uno");
  ok("Citas enseña el filtro con «Todos»", citas.includes("Todos"));
  ok("y los dos nombres en el filtro", citas.includes("Ana Benítez") && citas.includes("Beto Ruiz"));
  ok(
    "las dos familias aparecen, a la misma hora",
    citas.includes("Familia Uno") && citas.includes("Familia Dos"),
    "falta alguna de las dos citas simultáneas"
  );

  // Filtrar por una persona deja ver solo la suya.
  const chip = page.getByRole("button", { name: /Ana Benítez/ }).first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(800);
    const soloAna = await page.content();
    ok(
      "filtrar por Ana esconde la cita de Beto",
      soloAna.includes("Familia Uno") && !soloAna.includes("Familia Dos"),
      "el filtro no filtró"
    );
  } else {
    ok("el filtro por recurso existe", false, "no encontré el botón");
  }

  /**
   * 146 — Elegir un color NO puede borrar lo que todavía no se guardó.
   *
   * La primera versión guardaba el color en el acto, y guardar recarga la
   * lista desde el servidor: al cargar a los dos directores de Cerritos, un
   * clic en el círculo se llevó puesto el criterio recién escrito. Esto lo
   * fija para que no vuelva.
   */
  console.log("\n== El color no se lleva puesto lo escrito ==");
  {
    await abrir("/settings/calendar", "Quién atiende");
    const criterio = page
      .getByPlaceholder("cuando el alumno va de 4.º grado en adelante")
      .first();
    await criterio.fill("texto sin guardar");
    await page.getByRole("button", { name: "Violeta" }).first().click();
    await page.waitForTimeout(1200);
    ok(
      "el criterio sigue escrito después de elegir un color",
      (await criterio.inputValue()) === "texto sin guardar",
      "elegir color borró lo que no estaba guardado"
    );
  }

  console.log("\n== Con el interruptor apagado (los otros ocho clientes) ==");
  await interruptor(false);

  const ajustesSin = await abrir("/settings/calendar", "Horario de atención");
  ok("Ajustes → Agenda NO enseña «Quién atiende»", !ajustesSin.includes("Quién atiende"));
  ok("ni los nombres de nadie", !ajustesSin.includes("Ana Benítez"));
  ok(
    "pero el horario de atención sigue ahí",
    ajustesSin.includes("Horario de atención"),
    "se rompió la pantalla de siempre"
  );

  const citasSin = await abrir("/bookings?vista=semana", "Familia Uno");
  ok("Citas NO enseña el filtro por persona", !citasSin.includes("Beto Ruiz"));
  ok(
    "y las citas se siguen viendo",
    citasSin.includes("Familia Uno") || citasSin.includes("Familia Dos"),
    "la pantalla de siempre se quedó vacía"
  );
} finally {
  await interruptor(true);
  await browser.close();
  await sql.end({ timeout: 5 });
}

console.log(`\n${checks - fallos}/${checks} comprobaciones correctas.`);
if (fallos > 0) {
  console.log(`\n❌ ${fallos} fallo(s).\n`);
  process.exit(1);
}
console.log("\n✅ Las pantallas se comportan, encendida y apagada.\n");
