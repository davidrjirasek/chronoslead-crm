import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 142 — Plantillas por el transporte de Zernio.
 *
 * Lo que se prueba es la frontera con el proveedor: qué se le manda y cómo se
 * lee lo que contesta. Es la parte que se rompe sola cuando Zernio cambia un
 * envoltorio, y la única que se puede probar sin base de datos ni red.
 *
 * Fixtures inventados: este repo es público y un test no lleva el
 * identificador de un cliente ni el teléfono de nadie.
 */

const llamadas: { path: string; opts: Record<string, unknown> }[] = [];
let respuesta: unknown = {};

vi.mock("@/server/zernio", () => ({
  zernioFetch: async (path: string, opts: Record<string, unknown>) => {
    llamadas.push({ path, opts });
    return respuesta;
  },
}));

const {
  createZernioTemplate,
  listZernioTemplates,
  sendZernioTemplate,
} = await import("@/server/whatsapp/zernio-templates");

const CUENTA = "000000000000000000000001";

const CREDENCIALES = {
  id: "cred_test",
  organizationId: "org_test",
  accountRef: CUENTA,
  displayPhoneNumber: "+595 000 000001",
  verifiedName: "Negocio de prueba",
  status: "connected" as const,
  token: "llave-de-prueba",
  webhookSecret: null,
};

beforeEach(() => {
  llamadas.length = 0;
  respuesta = {};
});

describe("crear una plantilla", () => {
  it("manda el cuerpo con un ejemplo por variable", async () => {
    respuesta = { template: { id: "123456", status: "PENDING" } };

    const res = await createZernioTemplate({
      credentials: CREDENCIALES,
      name: "cita_agendada_equipo",
      language: "es",
      category: "UTILITY",
      body: "Hola {{1}}: hay una cita con {{2}}, y su teléfono es {{3}}.",
      examples: ["Ana", "Juan Pérez", "+595 000 000002"],
    });

    expect(res).toEqual({ waTemplateId: "123456", status: "PENDING" });

    const [llamada] = llamadas;
    expect(llamada!.path).toBe("/whatsapp/templates");
    expect(llamada!.opts.method).toBe("POST");
    const body = llamada!.opts.body as Record<string, unknown>;
    expect(body.accountId).toBe(CUENTA);
    expect(body.components).toEqual([
      {
        type: "body",
        text: "Hola {{1}}: hay una cita con {{2}}, y su teléfono es {{3}}.",
        example: { body_text: [["Ana", "Juan Pérez", "+595 000 000002"]] },
      },
    ]);
  });

  it("omite el ejemplo cuando la plantilla no tiene variables", async () => {
    respuesta = { template: { id: "7", status: "PENDING" } };

    await createZernioTemplate({
      credentials: CREDENCIALES,
      name: "aviso_simple",
      language: "es",
      category: "UTILITY",
      body: "Tenés un aviso nuevo.",
      examples: [],
    });

    const body = llamadas[0]!.opts.body as { components: Record<string, unknown>[] };
    expect(body.components[0]).not.toHaveProperty("example");
  });

  it("sobrevive a una respuesta sin id", async () => {
    respuesta = { success: true };
    const res = await createZernioTemplate({
      credentials: CREDENCIALES,
      name: "x",
      language: "es",
      category: "UTILITY",
      body: "Hola.",
      examples: [],
    });
    expect(res.waTemplateId).toBeNull();
    expect(res.status).toBe("PENDING");
  });
});

describe("listar plantillas", () => {
  it("lee las dos formas de envoltorio", async () => {
    const fila = {
      id: "1",
      name: "cita_agendada_equipo",
      language: "es",
      status: "APPROVED",
      category: "UTILITY",
    };

    respuesta = { templates: [fila] };
    expect(await listZernioTemplates(CREDENCIALES)).toHaveLength(1);

    respuesta = { data: { templates: [fila] } };
    expect(await listZernioTemplates(CREDENCIALES)).toHaveLength(1);
  });

  it("descarta filas sin nombre o sin idioma", async () => {
    respuesta = {
      templates: [
        { id: "1", name: "buena", language: "es", status: "APPROVED" },
        { id: "2", name: "", language: "es", status: "APPROVED" },
        { id: "3", name: "sin_idioma", status: "APPROVED" },
      ],
    };
    const res = await listZernioTemplates(CREDENCIALES);
    expect(res.map((t) => t.name)).toEqual(["buena"]);
  });

  it("acepta el motivo de rechazo en sus dos grafías", async () => {
    respuesta = {
      templates: [
        { id: "1", name: "a", language: "es", status: "REJECTED", rejected_reason: "SNAKE" },
        { id: "2", name: "b", language: "es", status: "REJECTED", rejectedReason: "CAMEL" },
      ],
    };
    const res = await listZernioTemplates(CREDENCIALES);
    expect(res.map((t) => t.rejectedReason)).toEqual(["SNAKE", "CAMEL"]);
  });

  it("devuelve lista vacía si el envoltorio no trae nada", async () => {
    respuesta = { success: true };
    expect(await listZernioTemplates(CREDENCIALES)).toEqual([]);
  });
});

describe("enviar una plantilla", () => {
  it("abre la conversación con el teléfono en dígitos", async () => {
    respuesta = { data: { conversationId: "conv_1", messageId: "msg_1" } };

    const res = await sendZernioTemplate({
      credentials: CREDENCIALES,
      toPhone: "+595 000 000002",
      templateName: "cita_agendada_equipo",
      templateLanguage: "es",
      params: ["Ana", "Juan Pérez"],
    });

    const [llamada] = llamadas;
    expect(llamada!.path).toBe("/inbox/conversations");
    expect(llamada!.opts.method).toBe("POST");
    const body = llamada!.opts.body as Record<string, unknown>;
    // Sin `+`, sin espacios: es lo que pide Zernio en `participantId`.
    expect(body.participantId).toBe("595000000002");
    expect(body.templateName).toBe("cita_agendada_equipo");
    expect(body.templateParams).toEqual(["Ana", "Juan Pérez"]);

    expect(res).toEqual({ platformMessageId: "msg_1", conversationId: "conv_1" });
  });

  it("lee también la respuesta sin envoltorio `data`", async () => {
    respuesta = { conversationId: "conv_2", messageId: "msg_2" };
    const res = await sendZernioTemplate({
      credentials: CREDENCIALES,
      toPhone: "595000000002",
      templateName: "x",
      templateLanguage: "es",
      params: [],
    });
    expect(res).toEqual({ platformMessageId: "msg_2", conversationId: "conv_2" });
  });

  it("nunca deja el mensaje sin referencia", async () => {
    respuesta = { data: { conversationId: "conv_3" } };
    const res = await sendZernioTemplate({
      credentials: CREDENCIALES,
      toPhone: "595000000002",
      templateName: "x",
      templateLanguage: "es",
      params: [],
    });
    expect(res.conversationId).toBe("conv_3");
    expect(res.platformMessageId).toMatch(/^zernio_tpl_\d+$/);
  });
});
