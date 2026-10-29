import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..", "..");
const leer = (p: string) => readFileSync(path.join(RAIZ, p), "utf8");

/**
 * 134 — El enlace de acceso dice de quién es la cuenta.
 *
 * Lo detectó el dueño al generar el enlace de soporte de su primer cliente:
 * «fijo contraseña, pero ¿para qué usuario?». La pantalla solo decía el
 * nombre de la organización.
 */
describe("la pantalla de elegir contraseña", () => {
  it("muestra el correo de la cuenta", () => {
    // Una empresa con varias personas no sabe cuál de sus correos quedó como
    // dueño; y el operador que se genera uno para soporte no ve si acertó.
    const pantalla = leer("src/components/activar/elegir-contrasena.tsx");
    expect(pantalla).toContain("Vas a elegir la contraseña de");
    expect(pantalla).toMatch(/\{correo\}/);
  });

  it("el correo viaja desde la validación del enlace, no se adivina", () => {
    const acceso = leer("src/server/platform/access-link.ts");
    expect(acceso).toMatch(/correo:\s*schema\.user\.email/);
    expect(acceso).toMatch(/innerJoin\(schema\.user/);
  });

  it("la página se lo pasa al componente", () => {
    expect(leer("src/app/(auth)/activar/[token]/page.tsx")).toContain(
      "correo={enlace.correo}"
    );
  });
});
