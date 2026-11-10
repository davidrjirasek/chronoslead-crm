import { describe, expect, it } from "vitest";
import { AgentAction, agentActionSchema, degradeAction } from "@/server/ai/actions";
import {
  nombreDelContacto,
  telefonoDelAviso,
  variablesDeCita,
} from "@/server/ai/aviso-de-cita";
import { nombreDePila } from "@/server/ai/recordatorio-de-cita";
import { horaEnZona } from "@/server/agenda/recordatorios";

/**
 * 142 — El ciclo de vida de la cita.
 *
 * Lo que se prueba acá son las decisiones puras: qué acciones existen, en qué
 * orden van las variables de cada plantilla y cómo degrada el turno cuando el
 * motor no puede. El orden de las variables es lo más frágil de todo: si se
 * cruzan, el aviso sale con el teléfono donde va la fecha y Meta no avisa de
 * nada porque el mensaje es válido.
 */

describe("las acciones nuevas", () => {
  it("acepta reschedule_slot con un horario", () => {
    const res = AgentAction.safeParse({
      action: "reschedule_slot",
      startUtc: "2026-11-12T13:00:00.000Z",
      reply: "Te la muevo.",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza reschedule_slot sin horario: mover a ciegas no existe", () => {
    const res = AgentAction.safeParse({ action: "reschedule_slot" });
    expect(res.success).toBe(false);
  });

  it("book_slot acepta la puerta de la segunda cita, y es opcional", () => {
    // Sin la bandera: el caso normal, y el motor se niega si ya hay una cita.
    expect(
      AgentAction.safeParse({
        action: "book_slot",
        startUtc: "2026-11-12T13:00:00.000Z",
      }).success
    ).toBe(true);
    // Con la bandera: el cliente confirmó que quiere las dos.
    const dos = AgentAction.safeParse({
      action: "book_slot",
      startUtc: "2026-11-12T13:00:00.000Z",
      allowSecond: true,
    });
    expect(dos.success).toBe(true);
    expect(dos.success && "allowSecond" in dos.data && dos.data.allowSecond).toBe(
      true
    );
  });

  it("acepta cancel_slot sin más datos", () => {
    const res = AgentAction.safeParse({ action: "cancel_slot" });
    expect(res.success).toBe(true);
  });

  it("no existen cuando la instancia no tiene agenda", () => {
    const sinAgenda = agentActionSchema(false);
    expect(
      sinAgenda.safeParse({
        action: "reschedule_slot",
        startUtc: "2026-11-12T13:00:00.000Z",
      }).success
    ).toBe(false);
    expect(sinAgenda.safeParse({ action: "cancel_slot" }).success).toBe(false);
    // Y las de siempre siguen estando.
    expect(sinAgenda.safeParse({ action: "reply", text: "hola" }).success).toBe(
      true
    );
  });

  it("degradan a la respuesta del modelo, nunca a agendar a ciegas", () => {
    expect(
      degradeAction({
        action: "reschedule_slot",
        startUtc: "2026-11-12T13:00:00.000Z",
        reply: "Te la muevo.",
      })
    ).toEqual({ action: "reply", text: "Te la muevo." });

    // Sin `reply` el turno se calla: inventar un texto sería prometer algo.
    expect(degradeAction({ action: "cancel_slot" })).toEqual({
      action: "none",
    });
  });
});

describe("las variables del aviso al equipo", () => {
  const base = {
    nombreDestino: "Nathalia",
    nombreDelContacto: "Lucía Franco",
    telefonoDelContacto: "+595 000 000002",
    cuando: "jue 12 nov, 10:00",
  };

  it("agendada: cuatro variables y el teléfono al final", () => {
    expect(variablesDeCita({ ...base, evento: "agendada" })).toEqual([
      "Nathalia",
      "Lucía Franco",
      "jue 12 nov, 10:00",
      "+595 000 000002",
    ]);
  });

  it("cancelada: mismo orden que agendada", () => {
    expect(variablesDeCita({ ...base, evento: "cancelada" })).toEqual([
      "Nathalia",
      "Lucía Franco",
      "jue 12 nov, 10:00",
      "+595 000 000002",
    ]);
  });

  it("reprogramada: cinco, con el horario viejo ANTES del nuevo", () => {
    expect(
      variablesDeCita({
        ...base,
        evento: "reprogramada",
        cuandoAntes: "mié 11 nov, 10:00",
      })
    ).toEqual([
      "Nathalia",
      "Lucía Franco",
      "mié 11 nov, 10:00",
      "jue 12 nov, 10:00",
      "+595 000 000002",
    ]);
  });

  it("nunca deja una variable vacía: Meta rechaza el envío", () => {
    const vars = variablesDeCita({
      evento: "agendada",
      nombreDestino: "   ",
      nombreDelContacto: null,
      telefonoDelContacto: null,
      cuando: "jue 12 nov, 10:00",
    });
    expect(vars.every((v) => v.trim().length > 0)).toBe(true);
    expect(vars[0]).toBe("equipo");
    expect(vars[1]).toBe("un contacto");
    expect(vars[3]).toBe("no registrado");
  });
});

describe("los rellenos", () => {
  it("un contacto sin nombre se nombra, no se deja en blanco", () => {
    expect(nombreDelContacto(null)).toBe("un contacto");
    expect(nombreDelContacto("  ")).toBe("un contacto");
    expect(nombreDelContacto(" Lucía ")).toBe("Lucía");
  });

  it("un contacto sin teléfono lo dice en vez de mentir", () => {
    expect(telefonoDelAviso(undefined)).toBe("no registrado");
    expect(telefonoDelAviso("+595 000 000002")).toBe("+595 000 000002");
  });
});

describe("el recordatorio al cliente", () => {
  it("usa solo el primer nombre", () => {
    expect(nombreDePila("Lucía Jazmín Franco")).toBe("Lucía");
    expect(nombreDePila(" Ana ")).toBe("Ana");
  });

  it("sin nombre devuelve null y el recordatorio no sale", () => {
    // La plantilla empieza por «Hola {{1}},»: cualquier relleno la arruina.
    expect(nombreDePila(null)).toBeNull();
    expect(nombreDePila("   ")).toBeNull();
  });
});

describe("la hora del recordatorio", () => {
  // 2026-11-12T13:00Z son las 10:00 en Asunción (GMT-3).
  const cita = new Date("2026-11-12T13:00:00.000Z");

  it("va en la zona del negocio, no en la del servidor", () => {
    expect(horaEnZona(cita, "America/Asuncion")).toBe("10:00");
  });

  it("una zona inválida no cuesta el recordatorio entero", () => {
    expect(horaEnZona(cita, "Marte/Olympus")).toBe("13:00");
  });
});
