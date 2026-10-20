import { describe, expect, it } from "vitest";
import {
  credencialDeOrganizacion,
  organizacionDeCredencial,
} from "@/server/bot/credencial";

const SECRETO = "secreto-del-despliegue-de-prueba-16+";
const OTRO_SECRETO = "otro-secreto-del-despliegue-distinto";
const ORG_A = "org_aaaaaaaaaaaaaaaa";
const ORG_B = "org_bbbbbbbbbbbbbbbb";

describe("credencial derivada por organización", () => {
  it("es determinista", () => {
    expect(credencialDeOrganizacion(ORG_A, SECRETO)).toBe(
      credencialDeOrganizacion(ORG_A, SECRETO)
    );
  });

  it("lleva la organización delante, para resolverla en O(1)", () => {
    expect(credencialDeOrganizacion(ORG_A, SECRETO).startsWith(`${ORG_A}.`)).toBe(
      true
    );
  });

  it("es distinta para cada organización", () => {
    expect(credencialDeOrganizacion(ORG_A, SECRETO)).not.toBe(
      credencialDeOrganizacion(ORG_B, SECRETO)
    );
  });

  it("rotar el secreto del despliegue invalida todas a la vez", () => {
    expect(credencialDeOrganizacion(ORG_A, SECRETO)).not.toBe(
      credencialDeOrganizacion(ORG_A, OTRO_SECRETO)
    );
  });
});

describe("resolver la organización de una credencial", () => {
  it("devuelve la suya", () => {
    const c = credencialDeOrganizacion(ORG_A, SECRETO);
    expect(organizacionDeCredencial(c, SECRETO)).toBe(ORG_A);
  });

  it("RECHAZA el secreto del despliegue a secas: no es una llave maestra", () => {
    expect(organizacionDeCredencial(SECRETO, SECRETO)).toBeNull();
  });

  it("RECHAZA una credencial con la organización cambiada a mano", () => {
    const c = credencialDeOrganizacion(ORG_A, SECRETO);
    const falsificada = c.replace(ORG_A, ORG_B);
    expect(organizacionDeCredencial(falsificada, SECRETO)).toBeNull();
  });

  it("RECHAZA la firma de A presentada como de B", () => {
    const firmaDeA = credencialDeOrganizacion(ORG_A, SECRETO).split(".")[1]!;
    expect(organizacionDeCredencial(`${ORG_B}.${firmaDeA}`, SECRETO)).toBeNull();
  });

  it("RECHAZA una credencial de otro despliegue", () => {
    const c = credencialDeOrganizacion(ORG_A, OTRO_SECRETO);
    expect(organizacionDeCredencial(c, SECRETO)).toBeNull();
  });

  it("rechaza vacíos y formas rotas sin lanzar", () => {
    for (const malo of [
      null,
      undefined,
      "",
      ".",
      ".firma",
      `${ORG_A}.`,
      "sinpunto",
      `${ORG_A}.firma.extra`,
    ]) {
      expect(organizacionDeCredencial(malo, SECRETO)).toBeNull();
    }
  });

  it("sin secreto del despliegue no valida nada", () => {
    const c = credencialDeOrganizacion(ORG_A, SECRETO);
    expect(organizacionDeCredencial(c, "")).toBeNull();
  });
});
