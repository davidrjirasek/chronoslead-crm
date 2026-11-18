/**
 * Self-test E2E de comportamiento — 146: la agenda por recurso.
 *
 * Conduce la app real y prueba lo que ninguna prueba unitaria puede probar,
 * porque vive en la base: que **dos recursos sean dos agendas de verdad**.
 *
 *  - AC-1 · dos citas a la misma hora, distinto recurso: las DOS entran.
 *    Este es el bug que la spec vino a arreglar: hasta hoy la segunda se
 *    rechazaba porque el índice único no miraba de quién era el turno.
 *  - AC-2 · dos citas a la misma hora, MISMO recurso: la segunda recibe
 *    `slot_taken` con alternativas, y no se crea nada.
 *  - AC-3 · un bloqueo SIN recurso borra ese hueco de los DOS: las vacaciones
 *    del colegio no son de una directora.
 *  - El interruptor: con la organización en modo agenda única, los endpoints
 *    de recursos no existen (404) y el calendario no trae recursos.
 *
 * Escribe los recursos por SQL directo —el interruptor lo prende el
 * superadmin, no este guion— y limpia todo lo que crea al terminar.
 *
 * Uso: node --env-file=.env scripts/e2e-agenda-recursos.mjs
 * Requiere: app viva con AGENDA=on y WA_MOCK_ENABLED=true, y la BD migrada.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * En EDITION=cloud nadie se da de alta solo: la organización la crea el
 * operador y su dueño fija la contraseña con un enlace de acceso. Este guion
 * hace lo mismo que el gate de aislamiento, por el mismo motivo — así es
 * repetible, y de paso ejercita el alta real.
 */
const SLUG = "e2erecursos";
const CORREO = "e2e-recursos@chronoslead.test";
const CONTRASENA = "contrasena-e2e-146";
const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "lvh.me";
const PUERTO = (process.env.APP_BASE_URL ?? "").match(/:(\d+)/)?.[1] ?? "3000";
const BASE = `http://${SLUG}.${BASE_DOMAIN}:${PUERTO}`;
const AGENDA = /^(on|1|true|si|sí|yes)$/i.test((process.env.AGENDA ?? "").trim());
const CORRIDA = Date.now();
const NOTA = `e2e-146-${CORRIDA}`;

let failures = 0;
let checks = 0;
function ok(name, cond, extra = "") {
  checks++;
  if (cond) console.log(`  OK  ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

let cookie = "";
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      origin: BASE,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(",").map((c) => c.split(";")[0]).join("; ");
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, json };
}

const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const creados = { recursos: [], citas: [] };

/** El próximo día de la semana con horario, a una hora que el motor ofrezca. */
function dentroDeLaVentana(slots, cuantos = 1) {
  return slots.slice(0, cuantos);
}

async function main() {
  if (!AGENDA) {
    console.log("AGENDA apagada: este guion no tiene nada que medir.");
    process.exit(0);
  }

  console.log("== Setup: alta y sesión ==");
  execFileSync("node", [".tmp-provision.mjs"], {
    env: {
      ...process.env,
      ORG_SLUG: SLUG,
      ORG_NAME: "E2E Recursos",
      ORG_ADMIN_EMAIL: CORREO,
    },
    stdio: "pipe",
  });

  let entrada = await api("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: CORREO, password: CONTRASENA },
  });
  if (entrada.status !== 200) {
    execFileSync("node", [".tmp-acceso.mjs"], {
      env: { ...process.env, ORG_ADMIN_EMAIL: CORREO },
      stdio: "pipe",
    });
    const txt = readFileSync(join(".provision", `acceso-${SLUG}.txt`), "utf8");
    const enlace = /enlace: (.+)/.exec(txt)?.[1]?.trim();
    const token = enlace?.split("/activar/")[1];
    await api("/api/activar", {
      method: "POST",
      body: { token, contrasena: CONTRASENA },
    });
    entrada = await api("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: CORREO, password: CONTRASENA },
    });
  }
  if (entrada.status === 429) {
    console.log("\n⏳ 429: el producto limita los logins. Esperá y repetí.\n");
    process.exit(2);
  }
  ok("la sesión queda abierta", entrada.status === 200, `recibido ${entrada.status}`);
  if (entrada.status !== 200) return;

  const [org] = await sql`
    select id, agenda_resources from organization where slug = ${SLUG} limit 1
  `;
  ok("la organización de la prueba existe", Boolean(org?.id));
  if (!org?.id) return;
  const ORG = org.id;

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n== El interruptor apagado: los recursos no existen ==");
  await sql`update organization set agenda_resources = false where id = ${ORG}`;
  {
    const lista = await api("/api/calendar/resources");
    ok("GET de recursos responde 404", lista.status === 404, `recibido ${lista.status}`);
    const alta = await api("/api/calendar/resources", {
      method: "POST",
      body: { name: "No debería entrar" },
    });
    ok("POST de recursos responde 404", alta.status === 404, `recibido ${alta.status}`);

    const hoy = new Date().toISOString().slice(0, 10);
    const citas = await api(`/api/bookings?from=${hoy}&to=${hoy}`);
    ok(
      "el calendario no trae recursos",
      citas.status === 200 && (citas.json?.recursos ?? []).length === 0,
      `recibido ${citas.status}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n== Con el interruptor y dos recursos ==");
  await sql`update organization set agenda_resources = true where id = ${ORG}`;

  const idA = `res_e2e_a_${CORRIDA}`;
  const idB = `res_e2e_b_${CORRIDA}`;
  await sql`
    insert into agenda_resource (id, organization_id, name, position)
    values (${idA}, ${ORG}, ${"Directora E2E"}, 0),
           (${idB}, ${ORG}, ${"Director E2E"}, 1)
  `;
  creados.recursos.push(idA, idB);

  {
    const lista = await api("/api/calendar/resources");
    ok(
      "ahora GET de recursos responde con los dos",
      lista.status === 200 && (lista.json?.recursos ?? []).length >= 2,
      `recibido ${lista.status}`
    );
  }

  // Un contacto para colgarle las citas.
  const contactoId = `ct_e2e146_${CORRIDA}`;
  await sql`
    insert into contact (id, organization_id, wa_identity, phone, name)
    values (${contactoId}, ${ORG}, ${`e2e146-${CORRIDA}`}, ${"595999000111"}, ${"Familia E2E"})
  `;

  const disp = await api("/api/calendar/availability");
  const slots = disp.json?.slots ?? [];
  ok("el motor ofrece huecos", slots.length >= 2, `${slots.length} huecos`);
  if (slots.length < 2) return;
  const [hueco] = dentroDeLaVentana(slots, 1);
  const cuando = hueco.startUtc;

  // ── AC-1 · misma hora, distinto recurso ──────────────────────────────────
  console.log("\n== AC-1: dos agendas son dos agendas ==");
  const primera = await api("/api/bookings", {
    method: "POST",
    body: {
      kind: "session",
      contactId: contactoId,
      startUtc: cuando,
      notes: `${NOTA}-A`,
      resourceId: idA,
    },
  });
  ok("la primera cita entra", primera.status < 300, `recibido ${primera.status}`);
  const idCita1 = primera.json?.booking?.id;
  if (idCita1) creados.citas.push(idCita1);

  const segunda = await api("/api/bookings", {
    method: "POST",
    body: {
      kind: "session",
      contactId: contactoId,
      startUtc: cuando,
      notes: `${NOTA}-B`,
      resourceId: idB,
    },
  });
  ok(
    "la segunda cita, a la MISMA hora, también entra",
    segunda.status < 300,
    `recibido ${segunda.status} — si es 409, el índice sigue sin mirar el recurso`
  );
  const idCita2 = segunda.json?.booking?.id;
  if (idCita2) creados.citas.push(idCita2);

  const juntas = await sql`
    select resource_id, scheduled_at from booking
    where organization_id = ${ORG} and notes like ${`${NOTA}-%`}
      and status = 'agendada' and kind = 'session'
  `;
  const mismoInstante =
    juntas.length === 2 &&
    juntas[0].scheduled_at.getTime() === juntas[1].scheduled_at.getTime();
  const recursosDistintos =
    new Set(juntas.map((r) => r.resource_id)).size === juntas.length;
  ok(
    "quedan DOS citas en el MISMO instante, una por recurso",
    mismoInstante && recursosDistintos,
    `${juntas.length} citas; recursos ${juntas.map((r) => r.resource_id).join(", ")}`
  );

  // ── AC-2 · misma hora, mismo recurso ─────────────────────────────────────
  console.log("\n== AC-2: el mismo recurso sigue sin poder duplicarse ==");
  {
    const choque = await api("/api/bookings", {
      method: "POST",
      body: {
        kind: "session",
        contactId: contactoId,
        startUtc: cuando,
        notes: `${NOTA}-choque`,
        resourceId: idA,
      },
    });
    ok(
      "una segunda cita del MISMO recurso a la misma hora se rechaza",
      choque.status === 409,
      `recibido ${choque.status}`
    );
    ok(
      "y el rechazo trae alternativas, no un error seco",
      Array.isArray(choque.json?.error?.slots ?? choque.json?.slots),
      JSON.stringify(choque.json).slice(0, 120)
    );
  }

  // ── AC-3 · un bloqueo sin recurso ocupa a todos ──────────────────────────
  console.log("\n== AC-3: un bloqueo del negocio ocupa a los dos ==");
  {
    const otro = slots[1]?.startUtc;
    const bloqueo = await api("/api/bookings", {
      method: "POST",
      body: {
        kind: "block",
        startUtc: otro,
        durationMinutes: 30,
        notes: `${NOTA}-bloqueo`,
      },
    });
    ok("el bloqueo se crea sin recurso", bloqueo.status < 300, `recibido ${bloqueo.status}`);
    const idBloqueo = bloqueo.json?.booking?.id;
    if (idBloqueo) creados.citas.push(idBloqueo);

    const después = await api("/api/calendar/availability");
    const libres = (después.json?.slots ?? []).map((s) => s.startUtc);
    ok(
      "ese horario ya no se ofrece",
      !libres.includes(otro),
      "el bloqueo no quitó el hueco"
    );
  }

  console.log(`\n${checks - failures}/${checks} comprobaciones correctas.`);
}

try {
  await main();
} finally {
  // Limpieza: esta prueba escribe en la base real de desarrollo.
  try {
    await sql`delete from booking where notes like ${`${NOTA}%`} or id like ${`bk_e2e146_%`}`;
    await sql`update organization set agenda_resources = false
              where id in (select organization_id from agenda_resource where id = any(${creados.recursos}))`;
    await sql`delete from agenda_resource where id = any(${creados.recursos})`;
    await sql`delete from contact where id like ${`ct_e2e146_%`}`;
  } catch (err) {
    console.log(`  (limpieza incompleta: ${err})`);
  }
  await sql.end({ timeout: 5 });
}

if (failures > 0) {
  console.log(`\n❌ ${failures} fallo(s).\n`);
  process.exit(1);
}
console.log("\n✅ La agenda de recursos se comporta.\n");
