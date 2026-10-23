import { describe, expect, it } from "vitest";
import {
  hayQueAvisar,
  quienEspera,
  horaDelAviso,
  motivoDelAviso,
  variablesDelAviso,
} from "@/server/ai/aviso-de-atencion";

describe("por qué espera esta conversación (el {{4}})", () => {
  it("las palabras del modelo ganan: dicen lo que hay que decidir", () => {
    // Esto es lo que una persona necesita leer en el teléfono para saber si
    // deja lo que está haciendo.
    expect(motivoDelAviso("modelo", "quiere visitar la propiedad")).toBe(
      "quiere visitar la propiedad"
    );
    expect(
      motivoDelAviso("cliente", "un proveedor espera respuesta por pagos")
    ).toBe("un proveedor espera respuesta por pagos");
  });

  it("sin palabras del modelo, el motivo técnico en castellano", () => {
    expect(motivoDelAviso("cliente", null)).toBe(
      "el cliente pidió hablar con una persona"
    );
    expect(motivoDelAviso("error", null)).toBe("falló el proveedor de IA");
    expect(motivoDelAviso("ventana", undefined)).toBe(
      "se cerró la ventana de 24 horas"
    );
  });

  it("una nota en blanco no cuenta como palabras", () => {
    expect(motivoDelAviso("cliente", "   ")).toBe(
      "el cliente pidió hablar con una persona"
    );
  });

  it("sin motivo ni nota, algo legible igual: nunca un aviso vacío", () => {
    expect(motivoDelAviso(null, null)).toBe("necesita atención humana");
  });
});

describe("cuándo corresponde avisar", () => {
  const base = {
    telefonoDestino: "+595981000000",
    esDePrueba: false,
    yaEstabaEscalada: false,
  };

  it("con destinatario, en vivo y recién escalada, avisa", () => {
    expect(hayQueAvisar(base)).toBe(true);
  });

  it("sin destinatario configurado NO avisa, y eso no es un error", () => {
    // Es el estado de todo cliente recién dado de alta.
    expect(hayQueAvisar({ ...base, telefonoDestino: null })).toBe(false);
    expect(hayQueAvisar({ ...base, telefonoDestino: "" })).toBe(false);
    expect(hayQueAvisar({ ...base, telefonoDestino: "   " })).toBe(false);
  });

  it("el Laboratorio jamás manda un aviso: sería la API real", () => {
    expect(hayQueAvisar({ ...base, esDePrueba: true })).toBe(false);
  });

  it("una conversación YA escalada no vuelve a avisar", () => {
    // Sin esto, un cliente que manda cinco mensajes genera cinco avisos.
    expect(hayQueAvisar({ ...base, yaEstabaEscalada: true })).toBe(false);
  });
});

describe("la hora del aviso", () => {
  const momento = new Date("2026-10-22T19:05:00Z");

  it("se da en la zona del negocio, no en la del servidor", () => {
    // Asunción está en UTC-3: las 19:05 UTC son las 16:05 allá.
    expect(horaDelAviso(momento, "America/Asuncion")).toBe("16:05");
    expect(horaDelAviso(momento, "UTC")).toBe("19:05");
  });

  it("una zona inválida guardada en Ajustes no cuesta el aviso entero", () => {
    expect(horaDelAviso(momento, "Marte/Olympus")).toBe("19:05");
  });
});

describe("quién espera (el {{2}})", () => {
  it("lleva el teléfono para que el aviso se pueda REENVIAR", () => {
    // Es el motivo de que esté: alguien del equipo que no entra a la
    // plataforma recibe el reenvío y ya tiene a quién escribirle.
    expect(quienEspera("Fernando Barreto", "+595981213569")).toBe(
      "Fernando Barreto (+595981213569)"
    );
  });

  it("sin teléfono va solo el nombre: un paréntesis vacío parece un error", () => {
    // Instagram y Messenger no dan teléfono.
    expect(quienEspera("dancitogodoy", null)).toBe("dancitogodoy");
    expect(quienEspera("Dr. Genoma", "  ")).toBe("Dr. Genoma");
    expect(quienEspera("rosario", undefined)).toBe("rosario");
  });

  it("sin nombre tampoco queda vacío: Meta rechaza una variable en blanco", () => {
    expect(quienEspera("", null)).toBe("un contacto");
    expect(quienEspera("  ", "+595981000000")).toBe("un contacto (+595981000000)");
  });
});

describe("las cuatro variables, en el orden que Meta espera", () => {
  it("se arman completas", () => {
    expect(
      variablesDelAviso({
        nombreDestino: "David",
        nombreDelContacto: "Fernando Barreto",
        telefonoDelContacto: "+595981213569",
        cuando: new Date("2026-10-22T19:05:00Z"),
        zonaHoraria: "America/Asuncion",
        motivo: "modelo",
        nota: "quiere agendar una visita",
      })
    ).toEqual([
      "David",
      "Fernando Barreto (+595981213569)",
      "16:05",
      "quiere agendar una visita",
    ]);
  });

  it("ningún hueco queda vacío: Meta rechaza una variable en blanco", () => {
    const v = variablesDelAviso({
      nombreDestino: null,
      nombreDelContacto: "",
      cuando: new Date("2026-10-22T19:05:00Z"),
      zonaHoraria: "UTC",
      motivo: null,
      nota: null,
    });
    expect(v).toEqual(["equipo", "un contacto", "19:05", "necesita atención humana"]);
    for (const x of v) expect(x.trim().length).toBeGreaterThan(0);
  });
});
