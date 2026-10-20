import { describe, expect, it } from "vitest";
import {
  correosDeSuperadmin,
  esCorreoDeSuperadmin,
} from "@/lib/tenant/superadmin";

const LISTA = "david@chronoslead.com, soporte@chronoslead.com";

describe("quién administra la plataforma", () => {
  it("reconoce a los de la lista", () => {
    expect(esCorreoDeSuperadmin("david@chronoslead.com", LISTA)).toBe(true);
    expect(esCorreoDeSuperadmin("soporte@chronoslead.com", LISTA)).toBe(true);
  });

  it("no le importan mayúsculas ni espacios: un correo es el mismo correo", () => {
    expect(esCorreoDeSuperadmin("  DAVID@ChronosLead.com ", LISTA)).toBe(true);
  });

  it("RECHAZA a cualquier otro, aunque sea dueño de una organización", () => {
    expect(esCorreoDeSuperadmin("mari@tortilleria.test", LISTA)).toBe(false);
    expect(esCorreoDeSuperadmin("david@chronoslead.com.evil.com", LISTA)).toBe(false);
    expect(esCorreoDeSuperadmin("otro@chronoslead.com", LISTA)).toBe(false);
  });

  it("sin lista NO hay superadmin: una variable vacía no abre la puerta a nadie", () => {
    expect(esCorreoDeSuperadmin("david@chronoslead.com", "")).toBe(false);
    expect(esCorreoDeSuperadmin("david@chronoslead.com", "   ,  , ")).toBe(false);
    expect(esCorreoDeSuperadmin("cualquiera@ejemplo.com", undefined as never)).toBe(
      false
    );
  });

  it("sin correo tampoco", () => {
    expect(esCorreoDeSuperadmin(null, LISTA)).toBe(false);
    expect(esCorreoDeSuperadmin(undefined, LISTA)).toBe(false);
    expect(esCorreoDeSuperadmin("", LISTA)).toBe(false);
    expect(esCorreoDeSuperadmin("   ", LISTA)).toBe(false);
  });

  it("la lista tolera espacios, comas sueltas y mayúsculas", () => {
    expect(correosDeSuperadmin(" A@x.com , ,B@x.com,  ")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
    expect(correosDeSuperadmin("")).toEqual([]);
  });
});
