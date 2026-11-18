/**
 * 146 — Ensayo del camino del AGENTE con agenda por recurso.
 *
 * El E2E por HTTP prueba el camino del operador. Este prueba el otro, que es
 * donde vive la garantía que más importa: **el instante y la persona se
 * prometen juntos**. Un hueco ofrecido para una directora no puede terminar
 * reservado en la agenda de la otra, porque quizás esa otra esté ocupada a esa
 * hora y nadie se enteraría hasta el día de la entrevista.
 *
 * Corre contra la base real de desarrollo, con los módulos del servidor de
 * verdad —no mocks— y limpia lo que crea.
 *
 * Uso: pnpm test:ensayo:recursos
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { bookSlot, offerSlots } from "@/server/agenda/agent";
import { getOffers } from "@/server/agenda/offers";

let fallos = 0;
let checks = 0;
function ok(nombre: string, cond: boolean, extra = "") {
  checks++;
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}${extra ? ` — ${extra}` : ""}`);
  }
}

const CORRIDA = Date.now();
const SLUG = "e2erecursos";

async function main() {
  const db = getDb();

  const [org] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, SLUG))
    .limit(1);
  if (!org) {
    console.log(
      `No existe la organización «${SLUG}». Corré antes pnpm test:e2e:recursos.`
    );
    process.exit(2);
  }
  const ORG = org.id;

  await db
    .update(schema.organization)
    .set({ agendaResources: true })
    .where(eq(schema.organization.id, ORG));

  const idA = `res_ens_a_${CORRIDA}`;
  const idB = `res_ens_b_${CORRIDA}`;
  await db.insert(schema.agendaResource).values([
    { id: idA, organizationId: ORG, name: "Directora Ensayo", position: 0 },
    { id: idB, organizationId: ORG, name: "Director Ensayo", position: 1 },
  ]);

  // Dos conversaciones distintas: dos familias pidiendo turno a la vez.
  const hechos: { contacto: string; conversacion: string }[] = [];
  for (const n of [1, 2]) {
    const contacto = newId("contact");
    const conversacion = newId("conversation");
    await db.insert(schema.contact).values({
      id: contacto,
      organizationId: ORG,
      waIdentity: `ensayo146-${CORRIDA}-${n}`,
      phone: `59599900011${n}`,
      name: `Familia Ensayo ${n}`,
    });
    await db.insert(schema.conversation).values({
      id: conversacion,
      organizationId: ORG,
      contactId: contacto,
      channel: "whatsapp",
    });
    hechos.push({ contacto, conversacion });
  }
  const [una, otra] = hechos as [
    { contacto: string; conversacion: string },
    { contacto: string; conversacion: string },
  ];

  console.log("== El agente pregunta cuando no sabe con quién ==");
  {
    const turno = await offerSlots({
      organizationId: ORG,
      conversationId: una.conversacion,
    });
    ok("sin recurso no ofrece horarios", turno.ok === false);
    ok(
      "y pregunta con quién, nombrando a los dos",
      turno.text.includes("Directora Ensayo") && turno.text.includes("Director Ensayo"),
      turno.text
    );
  }
  {
    const turno = await offerSlots({
      organizationId: ORG,
      conversationId: una.conversacion,
      resource: "Cristian el que no existe",
    });
    ok("un nombre inventado tampoco pasa", turno.ok === false);
  }

  console.log("\n== La oferta recuerda de quién era ==");
  const ofrecido = await offerSlots({
    organizationId: ORG,
    conversationId: una.conversacion,
    resource: "Directora Ensayo",
  });
  ok("ofrece horarios de la directora", ofrecido.ok === true, ofrecido.text);
  const ofertas = await getOffers(ORG, una.conversacion);
  ok("las ofertas quedan registradas", ofertas.length > 0);
  ok(
    "y todas llevan el id de la directora",
    ofertas.every((o) => o.resourceId === idA),
    JSON.stringify(ofertas.slice(0, 2))
  );

  console.log("\n== Reservar respeta la promesa ==");
  const instante = ofertas[0]!.startUtc;
  const reserva = await bookSlot({
    organizationId: ORG,
    conversationId: una.conversacion,
    startUtc: instante,
  });
  ok("la cita entra", reserva.ok === true, reserva.text);
  ok(
    "y queda en la agenda de la directora, no en la de cualquiera",
    reserva.resourceId === idA,
    `quedó en ${reserva.resourceId}`
  );

  console.log("\n== Y el otro sigue libre a esa hora ==");
  const ofrecidoB = await offerSlots({
    organizationId: ORG,
    conversationId: otra.conversacion,
    resource: "Director Ensayo",
  });
  ok("a la otra familia se le ofrecen horarios del director", ofrecidoB.ok === true);
  const ofertasB = await getOffers(ORG, otra.conversacion);
  ok(
    "el horario que la directora acaba de ocupar SIGUE ofreciéndose para el director",
    ofertasB.some((o) => o.startUtc === instante),
    "la agenda de una se le descontó a la otra"
  );

  const reservaB = await bookSlot({
    organizationId: ORG,
    conversationId: otra.conversacion,
    startUtc: instante,
  });
  ok("y la segunda familia agenda a la misma hora", reservaB.ok === true, reservaB.text);
  ok("en la agenda del director", reservaB.resourceId === idB, `quedó en ${reservaB.resourceId}`);

  // Limpieza
  for (const h of hechos) {
    await db.delete(schema.booking).where(eq(schema.booking.conversationId, h.conversacion));
    await db.delete(schema.conversation).where(eq(schema.conversation.id, h.conversacion));
    await db.delete(schema.contact).where(eq(schema.contact.id, h.contacto));
  }
  await db.delete(schema.agendaResource).where(eq(schema.agendaResource.id, idA));
  await db.delete(schema.agendaResource).where(eq(schema.agendaResource.id, idB));
  await db
    .update(schema.organization)
    .set({ agendaResources: false })
    .where(eq(schema.organization.id, ORG));

  console.log(`\n${checks - fallos}/${checks} comprobaciones correctas.`);
  if (fallos > 0) {
    console.log(`\n❌ ${fallos} fallo(s).\n`);
    process.exit(1);
  }
  console.log("\n✅ El agente agenda en la agenda correcta.\n");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
