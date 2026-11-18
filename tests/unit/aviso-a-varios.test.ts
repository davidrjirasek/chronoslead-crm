import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 146 — Que el aviso llegue a TODOS los que tienen que enterarse.
 *
 * Es lo que pidió el dueño el 18-nov-2026 y lo que hoy no se podía: la
 * organización tiene un solo `alert_phone`. En Cerritos, una entrevista de
 * hasta 3.º grado tiene que avisarle a tres personas —Carla, la directora
 * y la psicóloga— y una de 4.º en adelante a dos.
 *
 * Lo que se fija acá es el BUCLE: cuántos mensajes salen, a quién, y que el
 * fallo de uno no se lleve puestos a los demás.
 */

const sendTemplate = vi.fn(async (_args: { variables: string[] }) => ({
  ok: true,
}));
const recursoPorId = vi.fn();

const ORG = {
  alertPhone: "+595900000004",
  alertName: "Carla",
};
const CONV = {
  isTest: false,
  contactName: "Familia Prueba",
  contactPhone: "595900000009",
};
const PLANTILLA = [{ id: "tpl_1", name: "cita_agendada_equipo" }];

/** Cola de respuestas para cada `select(...)` en orden: org, conversación, plantilla. */
let selectRows: unknown[][] = [];

function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy", "innerJoin", "leftJoin"]) {
    c[m] = () => c;
  }
  c.limit = () => Promise.resolve(rows);
  return c;
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({ select: () => chain(selectRows.shift() ?? []) }),
}));
vi.mock("@/lib/db/schema", () => ({
  organization: { id: "id", alertPhone: "alert_phone", alertName: "alert_name" },
  conversation: { id: "id", organizationId: "organization_id", isTest: "is_test", contactId: "contact_id" },
  contact: { id: "id", name: "name", phone: "phone" },
  template: { id: "id", name: "name", status: "status", organizationId: "organization_id" },
}));
vi.mock("@/lib/db/tenant", () => ({ scoped: (_c: unknown, _o: unknown, extra: unknown) => extra }));
vi.mock("@/lib/meta/client", () => ({ normalizeMx: (p: string) => p.replace(/^0/, "595") }));
vi.mock("@/server/inbox/identity", () => ({
  getOrCreateContactByIdentity: async (_org: string, d: { phone: string }) => ({
    contact: { id: `ct_${d.phone}` },
  }),
}));
vi.mock("@/server/inbox/ingest", () => ({
  getOrCreateConversation: async (_org: string, contactId: string) => ({
    id: `cv_${contactId}`,
  }),
}));
vi.mock("@/server/whatsapp/templates", () => ({ sendTemplate }));
vi.mock("@/server/agenda/recursos", () => ({ recursoPorId }));

const { avisarDeCita } = await import("@/server/ai/aviso-de-cita");

beforeEach(() => {
  sendTemplate.mockClear();
  sendTemplate.mockImplementation(async () => ({ ok: true }));
  recursoPorId.mockReset();
  selectRows = [[ORG], [CONV], PLANTILLA];
});

describe("avisar de una cita", () => {
  it("sin recurso avisa a UNO: el de la organización, como siempre", async () => {
    await avisarDeCita({
      organizationId: "org_1",
      conversationId: "cv_cliente",
      evento: "agendada",
      cuando: "mar 24 nov, 14:00",
    });
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    expect(recursoPorId).not.toHaveBeenCalled();
  });

  it("una entrevista de hasta 3.º avisa a TRES: Carla, la directora y la psicóloga", async () => {
    recursoPorId.mockResolvedValue({
      id: "res_ana",
      name: "Ana Vera",
      avisos: [
        { phone: "+595900000001", name: "Ana" },
        { phone: "+595900000002", name: "Lea Ruiz" },
      ],
    });

    await avisarDeCita({
      organizationId: "org_1",
      conversationId: "cv_cliente",
      evento: "agendada",
      cuando: "mar 24 nov, 14:00",
      resourceId: "res_ana",
    });

    expect(sendTemplate).toHaveBeenCalledTimes(3);
    // Cada quien recibe su propio nombre en el saludo, no «equipo».
    const saludos = sendTemplate.mock.calls.map((c) => c[0].variables[0]);
    expect(saludos).toEqual(["Carla", "Ana", "Lea Ruiz"]);
  });

  it("una de 4.º en adelante avisa a DOS", async () => {
    recursoPorId.mockResolvedValue({
      id: "res_rodrigo",
      name: "Beto Ruiz",
      avisos: [{ phone: "+595900000003", name: "Beto" }],
    });

    await avisarDeCita({
      organizationId: "org_1",
      conversationId: "cv_cliente",
      evento: "agendada",
      cuando: "mar 24 nov, 14:00",
      resourceId: "res_rodrigo",
    });

    expect(sendTemplate).toHaveBeenCalledTimes(2);
  });

  it("el teléfono del cliente va en TODOS los avisos, no solo en el primero", async () => {
    recursoPorId.mockResolvedValue({
      id: "res_ana",
      name: "Ana Vera",
      avisos: [{ phone: "+595900000001", name: "Ana" }],
    });

    await avisarDeCita({
      organizationId: "org_1",
      conversationId: "cv_cliente",
      evento: "agendada",
      cuando: "mar 24 nov, 14:00",
      resourceId: "res_ana",
    });

    for (const call of sendTemplate.mock.calls) {
      expect(call[0].variables).toContain("595900000009");
    }
  });

  it("si falla el aviso a una persona, las demás reciben el suyo igual", async () => {
    recursoPorId.mockResolvedValue({
      id: "res_ana",
      name: "Ana Vera",
      avisos: [
        { phone: "+595900000001", name: "Ana" },
        { phone: "+595900000002", name: "Lea Ruiz" },
      ],
    });
    // El segundo revienta: el de Ana. Carla y Lea tienen que salir igual.
    sendTemplate.mockImplementationOnce(async () => ({ ok: true }));
    sendTemplate.mockImplementationOnce(async () => {
      throw new Error("Meta dijo que no");
    });

    await expect(
      avisarDeCita({
        organizationId: "org_1",
        conversationId: "cv_cliente",
        evento: "agendada",
        cuando: "mar 24 nov, 14:00",
        resourceId: "res_ana",
      })
    ).resolves.toBeUndefined();

    expect(sendTemplate).toHaveBeenCalledTimes(3);
  });

  it("una conversación del Laboratorio no avisa a nadie", async () => {
    selectRows = [[ORG], [{ ...CONV, isTest: true }], PLANTILLA];
    recursoPorId.mockResolvedValue({
      id: "res_ana",
      name: "Ana Vera",
      avisos: [{ phone: "+595900000001", name: "Ana" }],
    });

    await avisarDeCita({
      organizationId: "org_1",
      conversationId: "cv_ensayo",
      evento: "agendada",
      cuando: "mar 24 nov, 14:00",
      resourceId: "res_ana",
    });

    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("sin plantilla aprobada no sale nada, y no revienta", async () => {
    selectRows = [[ORG], [CONV], []];
    await avisarDeCita({
      organizationId: "org_1",
      conversationId: "cv_cliente",
      evento: "agendada",
      cuando: "mar 24 nov, 14:00",
    });
    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
