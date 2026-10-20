import { describe, expect, it } from "vitest";
import {
  estadoDeOrganizacion,
  mensajeDeSuspension,
  puedeEntrar,
} from "@/lib/tenant/estado";

const HOY = new Date("2026-10-20T12:00:00Z");
const GRACIA = 7;

/** Una organización sin nada puesto: ni fecha de pago ni suspensión manual. */
const limpia = {
  paidThrough: null,
  suspendedAt: null,
  suspendedReason: null,
};

function haceDias(n: number): Date {
  return new Date(HOY.getTime() - n * 24 * 60 * 60 * 1000);
}

describe("estado por la fecha de pago", () => {
  it("sin fecha es activa: nadie se queda fuera por un campo vacío", () => {
    expect(estadoDeOrganizacion(limpia, HOY, GRACIA)).toEqual({ estado: "activa" });
  });

  it("pagada hasta hoy es activa (el día de vencimiento se respeta entero)", () => {
    const org = { ...limpia, paidThrough: HOY };
    expect(estadoDeOrganizacion(org, HOY, GRACIA)).toEqual({ estado: "activa" });
  });

  it("pagada hasta el futuro es activa", () => {
    const org = { ...limpia, paidThrough: haceDias(-30) };
    expect(estadoDeOrganizacion(org, HOY, GRACIA)).toEqual({ estado: "activa" });
  });

  it("vencida ayer está en gracia, con 6 días por delante", () => {
    const org = { ...limpia, paidThrough: haceDias(1) };
    expect(estadoDeOrganizacion(org, HOY, GRACIA)).toEqual({
      estado: "gracia",
      diasRestantes: 6,
    });
  });

  it("el día 7 sigue en gracia: el último día cuenta", () => {
    const org = { ...limpia, paidThrough: haceDias(7) };
    expect(estadoDeOrganizacion(org, HOY, GRACIA)).toEqual({
      estado: "gracia",
      diasRestantes: 0,
    });
  });

  it("el día 8 queda suspendida por impago", () => {
    const org = { ...limpia, paidThrough: haceDias(8) };
    expect(estadoDeOrganizacion(org, HOY, GRACIA)).toEqual({
      estado: "suspendida",
      motivo: "impago",
    });
  });

  it("la hora del día no cambia el resultado: se cuentan fechas, no relojes", () => {
    const org = { ...limpia, paidThrough: new Date("2026-10-13T23:59:00Z") };
    const temprano = estadoDeOrganizacion(org, new Date("2026-10-20T00:01:00Z"), GRACIA);
    const tarde = estadoDeOrganizacion(org, new Date("2026-10-20T23:59:00Z"), GRACIA);
    expect(temprano).toEqual(tarde);
  });

  it("con 0 días de gracia, vencer un día ya suspende", () => {
    const org = { ...limpia, paidThrough: haceDias(1) };
    expect(estadoDeOrganizacion(org, HOY, 0)).toEqual({
      estado: "suspendida",
      motivo: "impago",
    });
  });
});

describe("suspensión manual", () => {
  it("gana aunque la cuenta esté pagada al día", () => {
    const org = {
      paidThrough: haceDias(-30),
      suspendedAt: haceDias(2),
      suspendedReason: "a petición del cliente",
    };
    expect(estadoDeOrganizacion(org, HOY, GRACIA)).toEqual({
      estado: "suspendida",
      motivo: "manual",
      razon: "a petición del cliente",
    });
  });

  it("pagar NO la levanta: la quita quien la puso", () => {
    const suspendida = {
      paidThrough: haceDias(10),
      suspendedAt: haceDias(2),
      suspendedReason: null,
    };
    const trasPagar = { ...suspendida, paidThrough: haceDias(-30) };
    expect(estadoDeOrganizacion(trasPagar, HOY, GRACIA).estado).toBe("suspendida");
  });

  it("al levantarla, vuelve a mandar la fecha de pago", () => {
    const levantada = {
      paidThrough: haceDias(-30),
      suspendedAt: null,
      suspendedReason: null,
    };
    expect(estadoDeOrganizacion(levantada, HOY, GRACIA)).toEqual({
      estado: "activa",
    });
  });
});

describe("quién puede entrar", () => {
  it("activa y en gracia entran; suspendida no", () => {
    expect(puedeEntrar({ estado: "activa" })).toBe(true);
    expect(puedeEntrar({ estado: "gracia", diasRestantes: 3 })).toBe(true);
    expect(puedeEntrar({ estado: "suspendida", motivo: "impago" })).toBe(false);
    expect(
      puedeEntrar({ estado: "suspendida", motivo: "manual", razon: null })
    ).toBe(false);
  });

  it("el mensaje distingue la causa sin dar detalles de facturación", () => {
    expect(mensajeDeSuspension({ estado: "suspendida", motivo: "impago" })).toContain(
      "falta de pago"
    );
    expect(
      mensajeDeSuspension({ estado: "suspendida", motivo: "manual", razon: "abuso" })
    ).not.toContain("abuso");
  });
});
