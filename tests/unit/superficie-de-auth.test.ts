import { describe, expect, it } from "vitest";
import { rutaDeOrganizacion } from "@/lib/auth/superficie";

/**
 * 121 — Las rutas del plugin de organización no se sirven.
 *
 * Resuelven sobre `session.activeOrganizationId` —la primera membresía del
 * usuario— y no miran el Host. Comprobado en vivo el 27-oct-2026: con sesión
 * en el subdominio de `prueba-b`, `remove-member` borró un miembro de
 * `prueba-a`. Con el administrador de soporte en varias organizaciones, eso
 * deja de ser teórico.
 */
describe("se cierra la API de organización de Better Auth", () => {
  it("cierra las rutas que hicieron daño en la prueba", () => {
    for (const r of [
      "http://sonrisa.lvh.me:3000/api/auth/organization/remove-member",
      "http://sonrisa.lvh.me:3000/api/auth/organization/update-member-role",
      "http://sonrisa.lvh.me:3000/api/auth/organization/get-full-organization",
      "https://cliente.chronoslead.com/api/auth/organization/set-active",
    ]) {
      expect(rutaDeOrganizacion(r)).toBe(true);
    }
  });

  it("NO toca el inicio de sesión ni el resto de la autenticación", () => {
    // Cerrar de más aquí deja a todos afuera del producto.
    for (const r of [
      "http://sonrisa.lvh.me:3000/api/auth/sign-in/email",
      "http://sonrisa.lvh.me:3000/api/auth/sign-out",
      "http://sonrisa.lvh.me:3000/api/auth/get-session",
      "http://sonrisa.lvh.me:3000/api/auth/sign-up/email",
    ]) {
      expect(rutaDeOrganizacion(r)).toBe(false);
    }
  });

  it("no se deja engañar por la consulta ni por un nombre parecido", () => {
    expect(
      rutaDeOrganizacion(
        "http://sonrisa.lvh.me:3000/api/auth/sign-in/email?x=/organization/remove-member"
      )
    ).toBe(false);
    expect(
      rutaDeOrganizacion("http://sonrisa.lvh.me:3000/api/auth/organizations")
    ).toBe(false);
  });

  it("una URL ilegible se deja pasar: cerrar por las dudas rompería el acceso", () => {
    expect(rutaDeOrganizacion("no-es-una-url")).toBe(false);
    expect(rutaDeOrganizacion("")).toBe(false);
  });
});
