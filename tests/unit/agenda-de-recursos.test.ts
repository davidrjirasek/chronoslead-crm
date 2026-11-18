import { describe, expect, it } from "vitest";
import { AgentAction } from "@/server/ai/actions";
import { destinatariosDelAviso } from "@/server/ai/aviso-de-cita";
import { horarioDelRecurso } from "@/server/agenda/availability";
import {
  lineasDeRecursos,
  parseAvisos,
  resolverRecurso,
  type Recurso,
} from "@/server/agenda/recursos";
import { candadoDeAgenda } from "@/server/agenda/service";
import { buildAgentSystemPrompt } from "@/server/ai/prompts";
import { DEFAULT_CALENDAR_SETTINGS } from "@/server/agenda/settings";

/**
 * 146 — La agenda de recursos.
 *
 * Lo que se prueba acá son las decisiones puras. La más importante no es que
 * los recursos funcionen: es que **una organización sin recursos siga
 * comportándose exactamente como antes**. Nueve clientes comparten la
 * instancia y solo uno pidió esto.
 */

const ana: Recurso = {
  id: "res_ana",
  name: "Ana Benítez",
  weeklyHours: { tue: [{ start: "13:30", end: "16:40" }] },
  color: "índigo",
  criterio: "cuando el alumno va de nivel inicial hasta 3.º grado",
  avisos: [
    { phone: "+595900000001", name: "Ana" },
    { phone: "0900 000 002", name: "Lea Ruiz" },
  ],
  position: 0,
};

const rodrigo: Recurso = {
  id: "res_rodrigo",
  name: "Beto Ruiz",
  weeklyHours: null,
  color: null,
  criterio: "cuando el alumno va de 4.º grado en adelante",
  avisos: [{ phone: "+595900000003", name: "Beto" }],
  position: 1,
};

/** Como normaliza el producto: se queda con los dígitos. */
const normalizar = (t: string) => t.replace(/\D/g, "").replace(/^0/, "595");

describe("resolver el recurso que nombró el modelo", () => {
  it("acepta el nombre exacto", () => {
    expect(resolverRecurso("Ana Benítez", [ana, rodrigo])?.id).toBe(
      "res_ana"
    );
  });

  it("perdona mayúsculas y acentos", () => {
    expect(resolverRecurso("ana benitez", [ana, rodrigo])?.id).toBe(
      "res_ana"
    );
  });

  it("acepta el nombre de pila cuando no hay ambigüedad", () => {
    expect(resolverRecurso("Beto", [ana, rodrigo])?.id).toBe(
      "res_rodrigo"
    );
  });

  it("NO adivina entre dos que empiezan igual", () => {
    const otraAna: Recurso = { ...ana, id: "res_m2", name: "Anabel Paz" };
    expect(resolverRecurso("Marie", [ana, otraAna])).toBeNull();
  });

  it("devuelve null con un nombre que no existe, para que el turno degrade", () => {
    expect(resolverRecurso("Cristian", [ana, rodrigo])).toBeNull();
  });

  it("devuelve null sin recursos, que es el caso de ocho de los nueve clientes", () => {
    expect(resolverRecurso("quien sea", [])).toBeNull();
  });
});

describe("el horario del recurso", () => {
  it("usa el suyo cuando lo tiene cargado", () => {
    const s = horarioDelRecurso(DEFAULT_CALENDAR_SETTINGS, ana);
    expect(s.weeklyHours).toEqual(ana.weeklyHours);
  });

  it("hereda el del negocio cuando no lo tiene", () => {
    const s = horarioDelRecurso(DEFAULT_CALENDAR_SETTINGS, rodrigo);
    expect(s.weeklyHours).toEqual(DEFAULT_CALENDAR_SETTINGS.weeklyHours);
  });

  it("sin recurso devuelve la configuración intacta", () => {
    expect(horarioDelRecurso(DEFAULT_CALENDAR_SETTINGS, null)).toBe(
      DEFAULT_CALENDAR_SETTINGS
    );
  });
});

describe("a quién se le avisa", () => {
  const org = { alertPhone: "+595900000004", alertName: "Carla" };

  it("sin recurso avisa a uno solo: el de siempre", () => {
    const d = destinatariosDelAviso({ org, delRecurso: [], normalizar });
    expect(d).toEqual([{ phone: "+595900000004", name: "Carla" }]);
  });

  it("con recurso suma los suyos, y el de la organización va primero", () => {
    const d = destinatariosDelAviso({
      org,
      delRecurso: ana.avisos,
      normalizar,
    });
    expect(d.map((x) => x.name)).toEqual(["Carla", "Ana", "Lea Ruiz"]);
  });

  it("una entrevista de 4.º en adelante manda dos avisos, no tres", () => {
    const d = destinatariosDelAviso({
      org,
      delRecurso: rodrigo.avisos,
      normalizar,
    });
    expect(d).toHaveLength(2);
  });

  it("no repite a quien ya estaba, aunque el número esté escrito distinto", () => {
    const d = destinatariosDelAviso({
      org,
      delRecurso: [{ phone: "0900 000 004", name: "Carla Ortiz" }],
      normalizar,
    });
    expect(d).toHaveLength(1);
    expect(d[0]?.name).toBe("Carla");
  });

  it("una organización sin destinatario y sin recursos no avisa a nadie", () => {
    const d = destinatariosDelAviso({
      org: { alertPhone: null, alertName: null },
      delRecurso: [],
      normalizar,
    });
    expect(d).toEqual([]);
  });

  it("descarta los avisos sin teléfono en vez de mandarlos a la nada", () => {
    const d = destinatariosDelAviso({
      org: { alertPhone: null, alertName: null },
      delRecurso: [
        { phone: "   ", name: "Fantasma" },
        { phone: "+595900000003", name: "Beto" },
      ],
      normalizar,
    });
    expect(d).toEqual([{ phone: "+595900000003", name: "Beto" }]);
  });
});

describe("lo que viene de la columna jsonb", () => {
  it("una lista bien formada pasa entera", () => {
    expect(parseAvisos([{ phone: "+595981", name: "Ana" }])).toEqual([
      { phone: "+595981", name: "Ana" },
    ]);
  });

  it("lo que no es lista devuelve vacío en vez de reventar", () => {
    expect(parseAvisos(null)).toEqual([]);
    expect(parseAvisos("0981123456")).toEqual([]);
    expect(parseAvisos({ phone: "0981" })).toEqual([]);
  });

  it("descarta la fila rota y conserva la buena", () => {
    expect(
      parseAvisos([{ name: "sin teléfono" }, 42, { phone: "+595981" }])
    ).toEqual([{ phone: "+595981", name: null }]);
  });
});

describe("el prompt", () => {
  const base = {
    profile: { name: "Asesor", tone: null, instructions: null, escalationRules: null, greeting: null } as never,
    kb: [],
    stages: [{ name: "Nuevo" }],
  };

  it("NO menciona recursos cuando la organización no los usa", () => {
    const p = buildAgentSystemPrompt({ ...base, agenda: true, recursos: [] });
    expect(p).not.toContain("Con quién se agenda");
    expect(p).not.toContain('"resource"');
  });

  it("los lista con su criterio cuando sí los usa", () => {
    const p = buildAgentSystemPrompt({
      ...base,
      agenda: true,
      recursos: lineasDeRecursos([ana, rodrigo]),
    });
    expect(p).toContain("Con quién se agenda");
    expect(p).toContain("Ana Benítez — cuando el alumno va de nivel inicial");
    expect(p).toContain("Beto Ruiz — cuando el alumno va de 4.º grado");
    expect(p).toContain("NUNCA elijas al azar");
  });

  it("sin agenda no habla de recursos aunque se los pasen", () => {
    const p = buildAgentSystemPrompt({
      ...base,
      agenda: false,
      recursos: lineasDeRecursos([ana, rodrigo]),
    });
    expect(p).not.toContain("Ana Benítez");
  });

  it("un recurso sin criterio se lista igual, solo con su nombre", () => {
    expect(lineasDeRecursos([{ ...rodrigo, criterio: null }])).toEqual([
      "- Beto Ruiz",
    ]);
  });
});

describe("la acción del agente", () => {
  it("acepta offer_slots con recurso", () => {
    const res = AgentAction.safeParse({
      action: "offer_slots",
      reply: "Te paso horarios",
      resource: "Ana Benítez",
    });
    expect(res.success).toBe(true);
  });

  it("sigue aceptando offer_slots sin recurso: es el camino de siempre", () => {
    expect(AgentAction.safeParse({ action: "offer_slots" }).success).toBe(true);
  });
});

describe("el candado de reserva", () => {
  it("dos recursos de la misma organización no comparten llave", () => {
    expect(candadoDeAgenda("org_1", "res_ana")).not.toBe(
      candadoDeAgenda("org_1", "res_rodrigo")
    );
  });

  it("el mismo recurso de dos organizaciones tampoco", () => {
    expect(candadoDeAgenda("org_1", "res_a")).not.toBe(
      candadoDeAgenda("org_2", "res_a")
    );
  });

  it("la agenda única tiene su propia llave, estable", () => {
    expect(candadoDeAgenda("org_1", null)).toBe(candadoDeAgenda("org_1", null));
    expect(candadoDeAgenda("org_1", null)).not.toBe(
      candadoDeAgenda("org_1", "res_a")
    );
  });
});
