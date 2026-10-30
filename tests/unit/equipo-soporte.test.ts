import { describe, expect, it } from "vitest";
import { partirCorreos, primerCorreoInvalido } from "@/server/equipo/soporte";

describe("136 · la lista de correos de soporte", () => {
  it("acepta coma, punto y coma, espacios y saltos de línea", () => {
    expect(partirCorreos("a@x.com, b@x.com; c@x.com\nd@x.com e@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
      "e@x.com",
    ]);
  });

  it("normaliza a minúsculas y no repite", () => {
    expect(partirCorreos("A@X.com, a@x.com")).toEqual(["a@x.com"]);
  });

  it("un campo vacío es una lista vacía, no un correo vacío", () => {
    expect(partirCorreos("")).toEqual([]);
    expect(partirCorreos("   ,  ; \n ")).toEqual([]);
  });

  it("señala el primero que está mal, con su nombre", () => {
    expect(primerCorreoInvalido(["a@x.com", "sin-arroba", "b@x.com"])).toBe("sin-arroba");
    expect(primerCorreoInvalido(["a@x.com", "b@x.com"])).toBeNull();
  });
});
