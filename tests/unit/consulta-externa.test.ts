import { describe, expect, it } from "vitest";
import { AgentAction, agentActionSchema } from "@/server/ai/actions";
import { valorDeLaRespuesta } from "@/server/consulta";
import { buildAgentSystemPrompt } from "@/server/ai/prompts";

/**
 * 151 — El agente le pregunta al sistema del negocio.
 *
 * La regla que atraviesa todo, heredada del diseño que ya funcionaba en Go
 * High Level y escrita en el brief de The Student Store:
 *
 * > «El modelo solo captura la cédula. El monto sale de la base, nunca del
 * > modelo, **para que no pueda inventarlo**.»
 *
 * Por eso lo que se prueba acá no es que la consulta funcione —eso es red—,
 * sino que el valor no pueda salir de ningún otro lado.
 */

const perfil = {
  name: "STU",
  tone: null,
  instructions: null,
  escalationRules: null,
  greeting: null,
} as never;

const base = { profile: perfil, kb: [], stages: [{ name: "Nuevo" }] };

describe("sacar el valor de la respuesta", () => {
  it("del campo configurado", () => {
    expect(valorDeLaRespuesta({ answer: "Gs. 45.000" }, "answer")).toBe(
      "Gs. 45.000"
    );
  });

  it("un número se devuelve como texto, sin tocarlo", () => {
    expect(valorDeLaRespuesta({ answer: 45000 }, "answer")).toBe("45000");
  });

  it("un arreglo con un objeto adentro: n8n devuelve así a veces", () => {
    expect(valorDeLaRespuesta([{ answer: "Gs. 12.000" }], "answer")).toBe(
      "Gs. 12.000"
    );
  });

  it("un envoltorio de una sola llave se abre", () => {
    expect(valorDeLaRespuesta({ data: { answer: "Gs. 1" } }, "answer")).toBe(
      "Gs. 1"
    );
  });

  it("si el campo configurado NO está, devuelve null en vez de adivinar otro", () => {
    // Lo importante del caso: hay un valor plausible al lado («saldo») y no se
    // usa. Adivinar acá es exactamente cómo se contesta un número equivocado.
    expect(valorDeLaRespuesta({ saldo: "Gs. 99.000" }, "answer")).toBeNull();
  });

  it("vacío o en blanco cuenta como que no vino", () => {
    expect(valorDeLaRespuesta({ answer: "" }, "answer")).toBeNull();
    expect(valorDeLaRespuesta({ answer: "   " }, "answer")).toBeNull();
    expect(valorDeLaRespuesta(null, "answer")).toBeNull();
  });

  it("una respuesta enorme se recorta: no entra un libro al prompt", () => {
    const largo = "x".repeat(5000);
    expect(valorDeLaRespuesta({ answer: largo }, "answer")!.length).toBe(600);
  });
});

describe("la acción del agente", () => {
  it("acepta el dato capturado", () => {
    const r = AgentAction.safeParse({
      action: "consultar",
      dato: "4567890",
      reply: "Dejame fijarme",
    });
    expect(r.success).toBe(true);
  });

  it("sin dato no vale: no se consulta al aire", () => {
    expect(AgentAction.safeParse({ action: "consultar" }).success).toBe(false);
    expect(
      AgentAction.safeParse({ action: "consultar", dato: "" }).success
    ).toBe(false);
  });

  it("el esquema del turno la incluye solo si la organización la tiene", () => {
    const sin = agentActionSchema(false, false);
    expect(sin.safeParse({ action: "consultar", dato: "1" }).success).toBe(
      false
    );
    const con = agentActionSchema(false, true);
    expect(con.safeParse({ action: "consultar", dato: "1" }).success).toBe(
      true
    );
  });

  it("con agenda y consulta conviven las dos", () => {
    const esquema = agentActionSchema(true, true);
    expect(esquema.safeParse({ action: "consultar", dato: "1" }).success).toBe(
      true
    );
    expect(esquema.safeParse({ action: "offer_slots" }).success).toBe(true);
  });
});

describe("el prompt", () => {
  it("no menciona la consulta cuando no hay ninguna configurada", () => {
    const p = buildAgentSystemPrompt({ ...base, consulta: null });
    expect(p).not.toContain("consultar");
  });

  it("la describe con su nombre, su criterio y qué pedir", () => {
    const p = buildAgentSystemPrompt({
      ...base,
      consulta: {
        nombre: "el saldo del alumno",
        criterio: "cuando un padre pregunta cuánto saldo le queda a su hijo",
        dato: "el número de cédula del alumno",
      },
    });
    expect(p).toContain("el saldo del alumno");
    expect(p).toContain("cuánto saldo le queda a su hijo");
    expect(p).toContain("el número de cédula del alumno");
  });

  it("le prohíbe decir el resultado por su cuenta: es LA regla", () => {
    const p = buildAgentSystemPrompt({
      ...base,
      consulta: { nombre: "el saldo", criterio: null, dato: "la cédula" },
    });
    expect(p).toContain("NUNCA digas vos el resultado");
    expect(p).toContain("Inventar un número");
  });

  it("y le dice qué hacer si el sistema no contesta", () => {
    const p = buildAgentSystemPrompt({
      ...base,
      consulta: { nombre: "el saldo", criterio: null, dato: "la cédula" },
    });
    expect(p).toContain("Si el sistema no contesta");
  });
});
