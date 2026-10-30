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

/**
 * La contraseña de las organizaciones del guion es ESTABLE, no depende de la
 * corrida: así una corrida que ya puede entrar no gasta una activación, y el
 * límite de intentos del producto (10 cada 10 minutos, que está bien que
 * exista) no convierte tres corridas seguidas en un rojo falso.
 */
const CLAVE_E2E = "aislamiento-e2e-2026";

const A = { slug: "e2ealfa", nombre: "E2E Alfa", correo: "duenoa@e2e.test", pnid: "900000000000001", contrasena: CLAVE_E2E };
const B = { slug: "e2ebeta", nombre: "E2E Beta", correo: "duenob@e2e.test", pnid: "900000000000002", contrasena: CLAVE_E2E };

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

/**
 * Siembra la organización y **fija su contraseña con un enlace de acceso**
 * (spec 106), en vez de leer la que escribió el alta.
 *
 * Es lo que hace el guion repetible: la sección 12 consume un enlace y con eso
 * cambia la contraseña del dueño. Leerla de `.provision/` funcionaba la primera
 * vez y dejaba la segunda corrida sin poder entrar — un gate intermitente
 * enseña a ignorar el rojo. De paso, la preparación ejercita el alta real y el
 * flujo de activación, que es más de lo que probaba antes.
 */
async function sembrar(org) {
  execFileSync("node", [".tmp-provision.mjs"], {
    env: {
      ...process.env,
      ORG_SLUG: org.slug,
      ORG_NAME: org.nombre,
      ORG_ADMIN_EMAIL: org.correo,
    },
    stdio: "pipe",
  });
  // Si ya puede entrar, no se gasta una activación.
  const intento = await entrar(org);
  if (intento === 200) return true;
  if (intento === 429) abortarPorLimite();

  const enlace = generarEnlaceAcceso(org);
  if (!enlace) return false;
  const token = enlace.split("/activar/")[1];
  const r = await fetch(`${origen(org)}/api/activar`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: origen(org) },
    body: JSON.stringify({ token, contrasena: org.contrasena }),
  });
  if (r.status === 429) abortarPorLimite();
  return r.status === 200;
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

/**
 * Un 429 no es un fallo de aislamiento: es que no se pudo medir.
 *
 * El producto limita los intentos de login a 10 cada 10 minutos por IP, y eso
 * está bien que exista. Encadenar corridas lo agota. Confundir «no pude medir»
 * con «el aislamiento está roto» es el mismo error que dar verde sin probar
 * nada, al revés: enseña a ignorar el rojo.
 */
function abortarPorLimite() {
  console.log("\n⏳ Límite de intentos alcanzado (429).");
  console.log("   Esto NO es un fallo de aislamiento: el guion no pudo medir.");
  console.log("   El producto permite 10 inicios de sesión cada 10 minutos por IP.");
  console.log("   Esperá unos minutos y volvé a correrlo.\n");
  process.exit(2);
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
  // Calienta las rutas ANTES de usarlas: en desarrollo la primera petición
  // compila y puede devolver un estado intermedio que no es el que se mide.
  await fetch(`${origen(A)}/api/health`).catch(() => {});
  await fetch(`${origen(B)}/api/health`).catch(() => {});

  ok("A se da de alta y fija su contraseña por enlace", await sembrar(A));
  ok("B se da de alta y fija su contraseña por enlace", await sembrar(B));

  const entradaA = await entrar(A);
  const entradaB = await entrar(B);
  if (entradaA === 429 || entradaB === 429) abortarPorLimite();
  ok("A inicia sesión en su host", entradaA === 200);
  ok("B inicia sesión en su host", entradaB === 200);
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

  /**
   * 121 — El punto ciego que este guion tuvo hasta el 27-oct-2026.
   *
   * Daba 45/45 mientras `/api/auth/organization/*` estaba abierta y resolvía
   * por `session.activeOrganizationId` —la primera membresía del usuario— sin
   * mirar el Host. Comprobado en vivo: con sesión en el subdominio de una
   * organización, `remove-member` borró un miembro de OTRA.
   *
   * Un visto bueno falso es peor que un rojo. Si alguien quita el guardián, o
   * la librería agrega rutas nuevas al actualizar, esto se pone colorado.
   */
  seccion("9b · La API de organización de Better Auth, tapiada");
  for (const ruta of [
    "remove-member",
    "update-member-role",
    "get-full-organization",
    "set-active",
  ]) {
    const r = await pedir(A, `/api/auth/organization/${ruta}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    ok(
      `${ruta} responde 404`,
      r.status === 404,
      `recibido ${r.status} — esa ruta resuelve por la membresía activa, no por el Host`
    );
  }
  // Y que no se haya cerrado de más: sin esto, nadie entra al producto.
  const sesionViva = await pedir(A, "/api/auth/get-session", { method: "GET" });
  ok(
    "el resto de la autenticación sigue en pie",
    sesionViva.status === 200,
    `recibido ${sesionViva.status}`
  );

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
    // Consumirlo cambia la contraseña de A: se vuelve a poner la estable para
    // que la corrida siguiente entre sin gastar otra activación.
    const propio = await activar(origen(A), token, A.contrasena);
    ok("el enlace de A SÍ vale en su subdominio", propio.status === 200, `recibido ${propio.status}`);
    const repetido = await activar(origen(A), token, `e2e-${RUN}-otra`);
    ok("y no vale una segunda vez", repetido.status >= 400);
  }

  seccion("13 · Recorridos completos (no solo las piezas)");
  /*
   * Lo que ve una persona: abrir, entrar y LLEGAR. Probar el login por un lado
   * y el panel por otro deja pasar justo lo que pasó: las dos piezas bien y el
   * operador parado en «esta instancia no existe» porque el login lo mandaba a
   * una raíz que en ese Host no es el panel.
   */
  const ADMIN = `http://admin.${BASE_DOMAIN}:${PUERTO}`;
  const loginAdmin = await fetch(`${ADMIN}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ADMIN },
    body: JSON.stringify({ email: A.correo, password: A.contrasena }),
  });
  const cookieAdmin = (loginAdmin.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  ok("el login de admin.* acepta credenciales válidas", loginAdmin.status === 200);

  if (cookieAdmin) {
    const raiz = await fetch(`${ADMIN}/`, { headers: { cookie: cookieAdmin } });
    const html = await raiz.text();
    // El dueño de A no es superadmin: tiene que llegar al panel y que el panel
    // le diga que no, no quedarse en una pantalla que no explica nada.
    ok(
      "tras entrar, la raíz de admin.* LLEVA al panel (no a «no existe»)",
      !html.includes("Esta instancia no existe"),
      "se quedó en la pantalla de instancia inexistente"
    );
    ok(
      "y el panel le niega el paso por no ser superadmin",
      html.includes("No tenés acceso a este panel"),
      "no mostró el rechazo esperado"
    );
  }

  const raizTenant = await pedir(A, "/");
  ok("la raíz del subdominio de A responde", raizTenant.status < 400, `recibido ${raizTenant.status}`);

  const apex = await fetch(`http://${BASE_DOMAIN}:${PUERTO}/`);
  const htmlApex = await apex.text();
  ok("la raíz del apex es la landing", apex.status === 200 && htmlApex.includes("ChronosLead"));

  seccion("14 · Gobierno del equipo (136)");
  /*
   * La regla: nadie actúa sobre un rango igual o superior al suyo.
   *
   * Se comprueba LLAMANDO LAS RUTAS, no mirando la pantalla. Esconder el botón
   * no protege nada: el botón solo redacta un pedido, y ese pedido se repite a
   * mano cambiándole el identificador. Si la regla viviera solo en el dibujo,
   * un administrador podría generar el enlace del propietario, consumirlo y
   * quedarse con la cuenta — y consumirlo BORRA las sesiones de la víctima.
   *
   * ORDEN: primero lo que se hace con la sesión de B, porque la 12 consumió un
   * enlace de A y eso le borró las sesiones. El reingreso de A va después y
   * sirve para dos cosas de una sola vez —recupera la cookie Y comprueba que
   * sumarlo al equipo de B no le tocó la contraseña—, que con el límite de 10
   * inicios cada 10 minutos no es un detalle.
   */
  /*
   * ORDEN: la 12 consumió un enlace de A y eso le borró las sesiones, así que
   * lo primero es volver a entrar. Con el límite de 10 inicios cada 10 minutos,
   * cada login se gasta a conciencia.
   */
  const reingresoA = await entrar(A);
  if (reingresoA === 429) abortarPorLimite();
  ok(
    "A vuelve a entrar tras usar su enlace de acceso",
    reingresoA === 200,
    `recibido ${reingresoA}`
  );

  const equipoB = await pedir(B, "/api/settings/team");
  ok("B ve su propio equipo", equipoB.status === 200, `recibido ${equipoB.status}`);
  const miembrosB = equipoB.status === 200 ? (await equipoB.json()).members : [];
  const duenoB = miembrosB.find((m) => m.role === "owner");

  /*
   * Alta unificada: la misma persona en dos empresas. Es el caso que estaba
   * roto —la ruta siempre llamaba a signUpEmail y respondía 409—, y es el de un
   * cliente dueño de dos negocios con un empleado en los dos.
   *
   * Se usa un usuario DESCARTABLE creado en esta corrida, nunca el dueño de A.
   * Sumar al dueño de A al equipo de B lo volvería miembro de las dos para
   * siempre, y entonces su cookie pasaría a valer en el host de B —con toda
   * razón, es lo que el producto promete— rompiendo las comprobaciones 2 y 6,
   * que miden a propósito el caso de alguien que NO es de la otra. Ya pasó: una
   * corrida dejó la fixture contaminada y las tres fallaron en la siguiente.
   */
  const EN_DOS = `dosempresas-${RUN}@e2e.test`;
  const naceEnA = await pedir(A, "/api/settings/team", {
    method: "POST",
    body: JSON.stringify({
      name: "Trabaja en las dos",
      email: EN_DOS,
      password: `Dos-${RUN}`,
      rol: "member",
    }),
  });
  ok("se crea una persona en A", naceEnA.status === 201, `recibido ${naceEnA.status}`);

  const sumadaEnB = await pedir(B, "/api/settings/team", {
    method: "POST",
    body: JSON.stringify({
      name: "Trabaja en las dos",
      email: EN_DOS,
      password: `Ignorada-${RUN}`,
      rol: "member",
    }),
  });
  ok(
    "y se puede sumar a la otra empresa, sin cuenta nueva",
    sumadaEnB.status === 201,
    `recibido ${sumadaEnB.status} — este era el 409 que rompía el caso de dos empresas`
  );
  if (sumadaEnB.status === 201) {
    const cuerpo = await sumadaEnB.json();
    ok(
      "se avisa que NO se le creó una cuenta nueva",
      cuerpo.creada === false,
      `creada=${cuerpo.creada}`
    );
  }
  const repetida = await pedir(B, "/api/settings/team", {
    method: "POST",
    body: JSON.stringify({
      name: "Trabaja en las dos",
      email: EN_DOS,
      password: `Ignorada-${RUN}`,
      rol: "member",
    }),
  });
  ok("sumarla dos veces no la duplica", repetida.status === 409, `recibido ${repetida.status}`);

  // Y se la saca de B, para no dejar la fixture sucia para la próxima corrida.
  const equipoBTrasAlta = await pedir(B, "/api/settings/team");
  const enB = (await equipoBTrasAlta.json()).members?.find((m) => m.email === EN_DOS);
  if (enB) {
    const limpieza = await pedir(B, `/api/settings/team/${enB.id}`, { method: "DELETE" });
    ok(
      "y la corrida deja el equipo de B como lo encontró",
      limpieza.status === 200,
      `recibido ${limpieza.status}`
    );
  }

  const equipoA = await pedir(A, "/api/settings/team");
  const miembrosA = equipoA.status === 200 ? (await equipoA.json()).members : [];
  const duenoA = miembrosA.find((m) => m.role === "owner");
  ok("A ve su propio equipo", Boolean(duenoA), `recibido ${equipoA.status}`);

  if (duenoB) {
    /*
     * Lo más importante de la sección: un identificador de OTRO cliente tiene
     * que dar lo mismo que uno inventado. Distinguirlos ya sería una fuga —le
     * diría al dueño de A que ese id existe en B.
     */
    const bajaAjena = await pedir(A, `/api/settings/team/${duenoB.id}`, { method: "DELETE" });
    ok(
      "A no puede quitar un miembro de B",
      bajaAjena.status === 404,
      `recibido ${bajaAjena.status} — un id ajeno debe dar 404, igual que uno inventado`
    );
    const rolAjeno = await pedir(A, `/api/settings/team/${duenoB.id}`, {
      method: "PATCH",
      body: JSON.stringify({ rol: "member" }),
    });
    ok(
      "A no puede cambiarle el rol a un miembro de B",
      rolAjeno.status === 404,
      `recibido ${rolAjeno.status}`
    );
    const enlaceAjeno = await pedir(A, `/api/settings/team/${duenoB.id}/enlace`, {
      method: "POST",
    });
    ok(
      "A no puede generar el enlace de un miembro de B",
      enlaceAjeno.status === 404,
      `recibido ${enlaceAjeno.status}`
    );
    const inventado = await pedir(A, "/api/settings/team/mem_noexiste/enlace", {
      method: "POST",
    });
    ok(
      "y un id inventado responde exactamente lo mismo",
      inventado.status === enlaceAjeno.status,
      `inventado ${inventado.status} vs ajeno ${enlaceAjeno.status} — distinguirlos filtra`
    );
  }

  if (duenoA) {
    const auto = await pedir(A, `/api/settings/team/${duenoA.id}`, { method: "DELETE" });
    ok("nadie se puede quitar a sí mismo", auto.status === 403, `recibido ${auto.status}`);
    const autoRol = await pedir(A, `/api/settings/team/${duenoA.id}`, {
      method: "PATCH",
      body: JSON.stringify({ rol: "member" }),
    });
    ok("ni cambiarse el rol a sí mismo", autoRol.status === 403, `recibido ${autoRol.status}`);
  }

  /*
   * La escalada que motivó la regla, medida de verdad: un administrador real,
   * con sesión propia, intentando tomar la cuenta del propietario.
   */
  const ADMIN_EQUIPO = {
    slug: A.slug,
    correo: `admin-equipo-${RUN}@e2e.test`,
    contrasena: `Equipo-${RUN}`,
  };
  const altaAdmin = await pedir(A, "/api/settings/team", {
    method: "POST",
    body: JSON.stringify({
      name: "Administrador de prueba",
      email: ADMIN_EQUIPO.correo,
      password: ADMIN_EQUIPO.contrasena,
      rol: "admin",
    }),
  });
  ok(
    "el propietario puede nombrar un administrador",
    altaAdmin.status === 201,
    `recibido ${altaAdmin.status}`
  );

  const entradaAdmin = await entrar(ADMIN_EQUIPO);
  if (entradaAdmin === 429) abortarPorLimite();
  ok("ese administrador puede entrar", entradaAdmin === 200, `recibido ${entradaAdmin}`);

  if (entradaAdmin === 200 && duenoA) {
    const enlaceDueno = await pedir(
      ADMIN_EQUIPO,
      `/api/settings/team/${duenoA.id}/enlace`,
      { method: "POST" }
    );
    ok(
      "un administrador NO puede generar el enlace del propietario",
      enlaceDueno.status === 403,
      `recibido ${enlaceDueno.status} — con esto se tomaba la cuenta`
    );

    const bajaDueno = await pedir(ADMIN_EQUIPO, `/api/settings/team/${duenoA.id}`, {
      method: "DELETE",
    });
    ok(
      "un administrador NO puede quitar al propietario",
      bajaDueno.status === 403,
      `recibido ${bajaDueno.status}`
    );

    const degradar = await pedir(ADMIN_EQUIPO, `/api/settings/team/${duenoA.id}`, {
      method: "PATCH",
      body: JSON.stringify({ rol: "member" }),
    });
    ok(
      "un administrador NO puede degradar al propietario",
      degradar.status === 403,
      `recibido ${degradar.status}`
    );

    const fabricarPar = await pedir(ADMIN_EQUIPO, "/api/settings/team", {
      method: "POST",
      body: JSON.stringify({
        name: "Par fabricado",
        email: `par-${RUN}@e2e.test`,
        password: `Par-${RUN}`,
        rol: "admin",
      }),
    });
    ok(
      "un administrador NO puede fabricar otro administrador",
      fabricarPar.status === 403,
      `recibido ${fabricarPar.status} — si no, esquiva la regla creando un par`
    );

    // Y que no se haya cerrado de más: sobre un rango MENOR sí puede actuar.
    const sobreMiembro = await pedir(A, "/api/settings/team", {
      method: "POST",
      body: JSON.stringify({
        name: "Miembro de prueba",
        email: `miembro-${RUN}@e2e.test`,
        password: `Miembro-${RUN}`,
        rol: "member",
      }),
    });
    const equipoTrasAlta = await pedir(A, "/api/settings/team");
    const nuevo = (await equipoTrasAlta.json()).members.find(
      (m) => m.email === `miembro-${RUN}@e2e.test`
    );
    ok("se creó un miembro para probar el camino feliz", sobreMiembro.status === 201 && Boolean(nuevo));
    if (nuevo) {
      const enlaceMiembro = await pedir(
        ADMIN_EQUIPO,
        `/api/settings/team/${nuevo.id}/enlace`,
        { method: "POST" }
      );
      ok(
        "un administrador SÍ puede destrabar a un miembro de Bandeja",
        enlaceMiembro.status === 200,
        `recibido ${enlaceMiembro.status} — si no, el cliente sigue dependiendo de nosotros`
      );
      const bajaMiembro = await pedir(ADMIN_EQUIPO, `/api/settings/team/${nuevo.id}`, {
        method: "DELETE",
      });
      ok(
        "y SÍ puede quitarlo del equipo",
        bajaMiembro.status === 200,
        `recibido ${bajaMiembro.status}`
      );
      const trasBaja = await pedir(A, "/api/settings/team");
      const sigue = (await trasBaja.json()).members.some((m) => m.id === nuevo.id);
      ok("la baja lo saca de la lista", !sigue);
    }
  }

  // La bitácora es de cada cliente: los movimientos de B no se ven desde A.
  const bitacoraA = await pedir(A, "/api/settings/team/bitacora");
  ok("A puede leer su bitácora", bitacoraA.status === 200, `recibido ${bitacoraA.status}`);
  if (bitacoraA.status === 200) {
    const texto = JSON.stringify((await bitacoraA.json()).movimientos ?? []);
    ok(
      "y no contiene ningún movimiento de B",
      !texto.includes(B.correo),
      "apareció el correo del dueño de B en la bitácora de A"
    );
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
