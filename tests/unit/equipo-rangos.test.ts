import { describe, expect, it } from "vitest";
import {
  puedeActuarSobre,
  puedeAsignarRol,
  puedeGobernarEquipo,
  rango,
} from "@/lib/auth/rangos";

describe("136 · rangos del equipo", () => {
  it("el propietario actúa sobre administradores y miembros", () => {
    expect(puedeActuarSobre("owner", "admin")).toBe(true);
    expect(puedeActuarSobre("owner", "member")).toBe(true);
  });

  it("un administrador NO actúa sobre el propietario", () => {
    expect(puedeActuarSobre("admin", "owner")).toBe(false);
  });

  it("un administrador NO actúa sobre otro administrador", () => {
    expect(puedeActuarSobre("admin", "admin")).toBe(false);
  });

  it("un administrador sí actúa sobre un miembro", () => {
    expect(puedeActuarSobre("admin", "member")).toBe(true);
  });

  it("un miembro no actúa sobre nadie", () => {
    for (const objetivo of ["owner", "admin", "member"]) {
      expect(puedeActuarSobre("member", objetivo)).toBe(false);
    }
  });

  it("nadie actúa sobre su propio rango: ni el propietario sobre otro propietario", () => {
    expect(puedeActuarSobre("owner", "owner")).toBe(false);
  });

  it("un rol desconocido no actúa ni recibe acción", () => {
    expect(puedeActuarSobre("superadmin", "member")).toBe(false);
    expect(puedeActuarSobre("owner", "fantasma")).toBe(false);
    expect(puedeActuarSobre(null, "member")).toBe(false);
    expect(puedeActuarSobre("owner", undefined)).toBe(false);
    expect(rango("cualquiera")).toBe(0);
  });

  it("un administrador NO puede nombrar administradores", () => {
    expect(puedeAsignarRol("admin", "admin")).toBe(false);
    expect(puedeAsignarRol("admin", "member")).toBe(true);
  });

  it("el propietario puede nombrar administradores, pero nadie nombra propietarios", () => {
    expect(puedeAsignarRol("owner", "admin")).toBe(true);
    expect(puedeAsignarRol("owner", "owner")).toBe(false);
  });

  it("solo administradores y propietario entran al panel de equipo", () => {
    expect(puedeGobernarEquipo("owner")).toBe(true);
    expect(puedeGobernarEquipo("admin")).toBe(true);
    expect(puedeGobernarEquipo("member")).toBe(false);
  });
});
