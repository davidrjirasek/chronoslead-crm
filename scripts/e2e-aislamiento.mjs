/**
 * 105 — El guion de aislamiento A/B. El gate.
 *
 * El aislamiento no falla en una función: falla en la COMPOSICIÓN. Una consulta
 * que olvidó `scoped()`, un cache de proceso que recuerda la organización
 * anterior, una cookie con dominio de más. Eso solo se ve ejerciendo todas las
 * superficies a la vez, con dos organizaciones vivas y la app real
 * respondiendo. Por eso es un guion y no tests sueltos, y por eso **mientras no
 * esté verde nada está Hecho**.
 *
 * Uso:
 *   1) app corriendo con EDITION=cloud, BASE_DOMAIN=lvh.me, WA_MOCK_ENABLED=true,
 *      META_GRAPH_BASE_URL → wa-mock y BOT_API_KEY configurada
 *   2) node --env-file=.env scripts/e2e-aislamiento.mjs
 *
 * Siembra sus propias organizaciones (`pnpm provision`, idempotente) y sale con
 * código 1 si algo falla, para que la CI lo bloquee.
 */
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "lvh.me";
const PUERTO = new URL(process.env.APP_BASE_URL ?? "http://lvh.me:3000").port || "3000";
const BOT_KEY = process.env.BOT_API_KEY ?? "";
const CLAVE = process.env.ENCRYPTION_KEY ?? "";

/**
 * Identificador de corrida en cada `wa_message_id` inyectado. Sin él la segunda
 * corrida se descarta por idempotencia y «prueba» justo lo contrario.
 */
const RUN = Date.now();

const A = { slug: "e2ealfa", nombre: "E2E Alfa", correo: "duenoa@e2e.test", pnid: "900000000000001" };
const B = { slug: "e2ebeta", nombre: "E2E Beta", correo: "duenob@e2e.test", pnid: "900000000000002" };

let fallos = 0;
let comprobaciones = 0;

function ok(nombre, condicion, extra = "") {
  comprobaciones++;
  if (condicion) {
    console.log(`  ✅ ${nombre}`);
  } else {
    fallos++;
    console.log(`  ❌ ${nombre}${extra ? ` — ${extra}` : ""}`);
  }
}

function seccion(titulo) {
  console.log(`\n${titulo}`);
}

/**
 * SIEMPRE por hostname real. El `fetch` de Node IGNORA la cabecera `Host` (es
 * una cabecera prohibida): pedir a 127.0.0.1 con `Host: alfa.lvh.me` haría que
 * todo llegara como `127.0.0.1` —un host que no es de nadie— y el guion
 * «detectaría» un aislamiento perfecto por el motivo equivocado.
 */
function origen(org) {
  return `http://${org.slug}.${BASE_DOMAIN}:${PUERTO}`;
}

async function pedir(org, ruta, opciones = {}) {
  const url = `${origen(org)}${ruta}`;
  return fetch(url, {
    ...opciones,
    headers: {
      "content-type": "application/json",
      // Como lo manda un navegador, CON puerto: es lo que ejercita de verdad
      // el comodín de trustedOrigins.
      origin: origen(org),
      ...(org.cookie ? { cookie: org.cookie } : {}),
      ...(opciones.headers ?? {}),
    },
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** El webhook acusa recibo ANTES de procesar: preguntar una vez mide latencia. */
async function reintentar(fn, intentos = 16, esperaMs = 300) {
  for (let i = 0; i < intentos; i++) {
    if (await fn()) return true;
    await dormir(esperaMs);
  }
  return false;
}

function recogerIds(valor, destino = new Set()) {
  if (Array.isArray(valor)) {
    for (const v of valor) recogerIds(v, destino);
  } else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) {
      if (k === "id" && typeof v === "string") destino.add(v);
      else recogerIds(v, destino);
    }
  }
  return destino;
}

function sembrar(org) {
  execFileSync("node", [".tmp-provision.mjs"], {
    env: {
      ...process.env,
      ORG_SLUG: org.slug,
      ORG_NAME: org.nombre,
      ORG_ADMIN_EMAIL: org.correo,
    },
    stdio: "pipe",
  });
  const txt = readFileSync(join(".provision", `${org.slug}.txt`), "utf8");
  org.contrasena = /contrasena: (.+)/.exec(txt)?.[1]?.trim();
}

/** Genera un enlace de acceso con el mismo comando que usa el operador. */
function generarEnlaceAcceso(org) {
  try {
    execFileSync("node", [".tmp-acceso.mjs"], {
      env: { ...process.env, ORG_ADMIN_EMAIL: org.correo },
      stdio: "pipe",
    });
    const txt = readFileSync(join(".provision", `acceso-${org.slug}.txt`), "utf8");
    return /enlace: (.+)/.exec(txt)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function entrar(org) {
  const r = await pedir(org, "/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: org.correo, password: org.contrasena }),
  });
  const cookies = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  org.cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  return r.status;
}

async function conectarWhatsApp(org) {
  const r = await pedir(org, "/api/settings/whatsapp", {
    method: "PUT",
    body: JSON.stringify({
      wabaId: `WABA-${org.slug}`,
      phoneNumberId: org.pnid,
      token: `EAAG-e2e-${org.slug}`,
    }),
  });
  return r.status;
}

function firmaWebhook(organizationId, version = 1) {
  return createHmac("sha256", CLAVE)
    .update(`chronoslead:webhook:v1:${organizationId}:${version}`)
    .digest("base64url");
}

function credencialBot(organizationId) {
  const firma = createHmac("sha256", BOT_KEY)
    .update(`chronoslead:cerebro:v1:${organizationId}`)
    .digest("base64url");
  return `${organizationId}.${firma}`;
}

function cuerpoEntrante(pnid, texto, sufijo) {
  return JSON.stringify({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: pnid, display_phone_number: "+52 55 0000 0000" },
              contacts: [{ wa_id: "5215512340000", profile: { name: "E2E Cliente" } }],
              messages: [
                {
                  from: "5215512340000",
                  id: `wamid.e2e.${RUN}.${sufijo}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: texto },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

/**
 * Lo que la app le enseña a ESA organización como su webhook. De ahí salen el
 * organizationId y la firma, en vez de construirlos: un id inventado haría que
 * todo respondiera 404 y el guion declararía aislamiento perfecto por el
 * motivo equivocado.
 */
async function datosWebhook(org) {
  const r = await pedir(org, "/api/settings/webhook");
  if (r.status !== 200) return null;
  const { url } = await r.json();
  const m = /\/api\/webhooks\/wa\/([^/]+)\/([^/?#]+)/.exec(url ?? "");
  return m ? { orgId: m[1], firma: m[2], url } : null;
}

async function conversacionesDe(org) {
  const r = await pedir(org, "/api/conversations");
  if (r.status !== 200) return null;
  return await r.json();
}

async function contieneTexto(org, texto) {
  const datos = await conversacionesDe(org);
  return JSON.stringify(datos ?? {}).includes(texto);
}

async function main() {
  console.log(`\nGuion de aislamiento A/B · corrida ${RUN}`);
  console.log(`Dominio base: ${BASE_DOMAIN}:${PUERTO}\n`);

  if (!CLAVE) {
    console.error("Falta ENCRYPTION_KEY: el guion no puede firmar los webhooks.");
    process.exit(1);
  }

  seccion("Preparación");
  sembrar(A);
  sembrar(B);
  ok("las dos organizaciones existen", Boolean(A.contrasena && B.contrasena));

  // Calienta las rutas: en desarrollo la primera petición compila y puede
  // devolver un estado intermedio que no es el que se quiere medir.
  await pedir(A, "/api/health");
  await pedir(B, "/api/health");

  ok("A inicia sesión en su host", (await entrar(A)) === 200);
  ok("B inicia sesión en su host", (await entrar(B)) === 200);
  if (!A.cookie || !B.cookie) {
    console.error("\nSin sesión no se puede seguir.");
    process.exit(1);
  }

  // La URL del webhook se la pide a la APP, no se construye: así el guion
  // ejercita además la pantalla que el cliente copia y pega en Meta, y no puede
  // «probar» el aislamiento porque todo dé 404 con un id inventado.
  const webhookA = await datosWebhook(A);
  const webhookB = await datosWebhook(B);
  ok("A ve su propia URL de webhook", Boolean(webhookA?.orgId));
  ok("B ve su propia URL de webhook", Boolean(webhookB?.orgId));
  ok(
    "las dos URLs son distintas",
    Boolean(webhookA?.orgId && webhookB?.orgId && webhookA.orgId !== webhookB.orgId)
  );
  if (!webhookA?.orgId || !webhookB?.orgId) {
    console.error("\nSin las URLs de webhook el resto del guion no probaría nada.");
    process.exit(1);
  }
  const orgIdA = webhookA.orgId;
  const orgIdB = webhookB.orgId;

  ok("A conecta su WhatsApp", (await conectarWhatsApp(A)) === 200);
  ok("B conecta su WhatsApp", (await conectarWhatsApp(B)) === 200);

  seccion("1 · Marca sin sesión");
  const loginA = await (await fetch(`${origen(A)}/login`)).text();
  const loginB = await (await fetch(`${origen(B)}/login`)).text();
  ok("el login de A muestra la marca de A", loginA.includes(A.nombre));
  ok("el login de A NO muestra la marca de B", !loginA.includes(B.nombre));
  ok("el login de B muestra la marca de B", loginB.includes(B.nombre));
  ok("el login de B NO muestra la marca de A", !loginB.includes(A.nombre));

  seccion("2 · Sesión");
  const cruzada = await fetch(`${origen(B)}/api/conversations`, {
    headers: { cookie: A.cookie, origin: origen(B) },
  });
  ok("la cookie de A en el host de B es rechazada", [401, 403].includes(cruzada.status), `recibido ${cruzada.status}`);
  ok("la cookie de A en SU host funciona", (await pedir(A, "/api/conversations")).status === 200);

  seccion("3-5 · Bandeja, pipeline y contactos");
  for (const [nombre, ruta] of [
    ["bandeja", "/api/conversations"],
    ["pipeline", "/api/pipeline/board"],
    ["contactos", "/api/contacts"],
  ]) {
    const ra = await pedir(A, ruta);
    const rb = await pedir(B, ruta);
    if (ra.status !== 200 || rb.status !== 200) {
      ok(`${nombre} responde a ambas`, false, `A=${ra.status} B=${rb.status}`);
      continue;
    }
    const idsA = recogerIds(await ra.json());
    const idsB = recogerIds(await rb.json());
    const cruce = [...idsA].filter((id) => idsB.has(id));
    ok(`${nombre}: ningún id se cruza`, cruce.length === 0, cruce.slice(0, 3).join(", "));
  }

  seccion("6 · Tiempo real (SSE)");
  const sse = await fetch(`${origen(B)}/api/events`, {
    headers: { cookie: A.cookie, origin: origen(B) },
  });
  ok("el stream de B rechaza la sesión de A", [401, 403].includes(sse.status), `recibido ${sse.status}`);
  if (sse.body) await sse.body.cancel();

  seccion("7 · Hosts que no son de nadie");
  const inexistente = await fetch(`http://noexiste${RUN}.${BASE_DOMAIN}:${PUERTO}/login`);
  const htmlInexistente = await inexistente.text();
  ok("un subdominio inexistente dice «esta instancia no existe»", htmlInexistente.includes("Esta instancia no existe"));
  ok("y no filtra la marca de nadie", !htmlInexistente.includes(A.nombre) && !htmlInexistente.includes(B.nombre));

  seccion("8 · Webhook: firmas que no valen");
  const puertaAConFirmaB = await fetch(
    `${origen(A)}/api/webhooks/wa/${orgIdA}/${firmaWebhook(orgIdB)}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: cuerpoEntrante(A.pnid, "no debe entrar", "firmaajena") }
  );
  ok("la firma de B no abre la puerta de A", puertaAConFirmaB.status === 404, `recibido ${puertaAConFirmaB.status}`);

  const puertaInventada = await fetch(
    `${origen(A)}/api/webhooks/wa/org_inventada/basura`,
    { method: "POST", headers: { "content-type": "application/json" }, body: cuerpoEntrante(A.pnid, "x", "inventada") }
  );
  ok("una organización inventada no tiene puerta", puertaInventada.status === 404);

  seccion("9 · ESCRITURA por webhook (la que más importa)");
  const marcaAtaque = `ATAQUE-${RUN}`;
  await fetch(`${origen(B)}/api/webhooks/wa/${orgIdB}/${firmaWebhook(orgIdB)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Entra por la puerta de B, pero el cuerpo dice que es para el número de A.
    body: cuerpoEntrante(A.pnid, marcaAtaque, "ataque"),
  });
  await dormir(3000);
  const seColo = await contieneTexto(A, marcaAtaque);
  ok("un evento por la puerta de B con el número de A NO entra en A", !seColo);
  ok("y tampoco aparece en B", !(await contieneTexto(B, marcaAtaque)));

  const marcaLegitima = `LEGITIMO-${RUN}`;
  await fetch(`${origen(A)}/api/webhooks/wa/${orgIdA}/${firmaWebhook(orgIdA)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: cuerpoEntrante(A.pnid, marcaLegitima, "legitimo"),
  });
  const entroEnA = await reintentar(() => contieneTexto(A, marcaLegitima));
  ok("el mismo evento por la puerta de A SÍ entra en A", entroEnA);
  ok("y no aparece en B", !(await contieneTexto(B, marcaLegitima)));

  seccion("10 · Cerebro: una credencial por organización");
  if (!BOT_KEY) {
    console.log("  –  sin BOT_API_KEY: omitido");
  } else {
    const perfil = async (clave) =>
      (await fetch(`${origen(A)}/api/bot/profile`, { headers: { "x-api-key": clave } })).status;
    ok("el secreto del despliegue a secas no vale", (await perfil(BOT_KEY)) === 401);
    ok("la credencial de A vale", (await perfil(credencialBot(orgIdA))) === 200);
    const firmaDeA = credencialBot(orgIdA).split(".")[1];
    ok("la firma de A con el id de B no vale", (await perfil(`${orgIdB}.${firmaDeA}`)) === 401);
  }

  seccion("11 · Suspensión (104)");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    // La fecha se mueve en la base porque hasta la spec 107 no hay panel: es
    // exactamente como se opera hoy.
    await sql`update organization set paid_through = now() - interval '20 days' where id = ${orgIdA}`;

    const trasCortar = await pedir(A, "/api/conversations");
    ok("A suspendida no entra", [401, 403].includes(trasCortar.status), `recibido ${trasCortar.status}`);
    ok("B sigue entrando: solo se cortó quien debía", (await pedir(B, "/api/conversations")).status === 200);

    // Un WhatsApp a la suspendida: se guarda, pero el agente no contesta.
    const marcaSuspendida = `SUSPENDIDA-${RUN}`;
    const salientesAntes = Number(
      (await sql`select count(*) as n from message where organization_id = ${orgIdA} and direction = 'out'`)[0].n
    );
    await fetch(`${origen(A)}/api/webhooks/wa/${orgIdA}/${webhookA.firma}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: cuerpoEntrante(A.pnid, marcaSuspendida, "suspendida"),
    });
    const seGuardo = await reintentar(async () => {
      const filas = await sql`select count(*) as n from message m join conversation c on c.id = m.conversation_id where c.organization_id = ${orgIdA} and m.text = ${marcaSuspendida}`;
      return Number(filas[0].n) > 0;
    });
    ok("el mensaje a una organización suspendida SE GUARDA", seGuardo);

    await dormir(12000);
    const salientesDespues = Number(
      (await sql`select count(*) as n from message where organization_id = ${orgIdA} and direction = 'out'`)[0].n
    );
    ok("y el agente NO contesta por ella", salientesDespues === salientesAntes, `${salientesAntes} → ${salientesDespues}`);

    await sql`update organization set paid_through = null where id = ${orgIdA}`;
    ok("al reactivar vuelve a entrar", (await pedir(A, "/api/conversations")).status === 200);
  } finally {
    await sql.end({ timeout: 5 });
  }

  seccion("12 · Enlaces de acceso (106)");
  const enlaceDeA = generarEnlaceAcceso(A);
  ok("se genera un enlace para el dueño de A", Boolean(enlaceDeA));
  if (enlaceDeA) {
    const token = enlaceDeA.split("/activar/")[1];
    const activar = (origenHost, tok, pw) =>
      fetch(`${origenHost}/api/activar`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: origenHost },
        body: JSON.stringify({ token: tok, contrasena: pw }),
      });
    const cruzado = await activar(origen(B), token, `e2e-${RUN}-cruzado`);
    ok("el enlace de A NO vale en el subdominio de B", cruzado.status >= 400, `recibido ${cruzado.status}`);
    const inventado = await activar(origen(A), `inventado-${RUN}`, `e2e-${RUN}-x`);
    ok("un enlace inventado da la misma respuesta", inventado.status >= 400);
    const propio = await activar(origen(A), token, `e2e-${RUN}-propio`);
    ok("el enlace de A SÍ vale en su subdominio", propio.status === 200, `recibido ${propio.status}`);
    const repetido = await activar(origen(A), token, `e2e-${RUN}-otra`);
    ok("y no vale una segunda vez", repetido.status >= 400);
  }

  console.log(`\n${comprobaciones - fallos}/${comprobaciones} comprobaciones correctas.`);
  if (fallos > 0) {
    console.log(`\n❌ ${fallos} fallo(s). NADA está Hecho hasta que esto esté verde.\n`);
    process.exit(1);
  }
  console.log("\n✅ Aislamiento verde.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
