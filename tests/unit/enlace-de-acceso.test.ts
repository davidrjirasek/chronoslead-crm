import { describe, expect, it } from "vitest";
import {
  DIAS_DE_VALIDEZ,
  MIN_LONGITUD_CONTRASENA,
  urlDeEnlace,
} from "@/server/platform/access-link";

describe("la URL que el operador entrega", () => {
  it("cuelga del subdominio de la organización", () => {
    expect(urlDeEnlace("suclinica", "chronoslead.com", "TOK", "https://chronoslead.com")).toBe(
      "https://suclinica.chronoslead.com/activar/TOK"
    );
  });

  it("conserva el puerto en desarrollo: sin él el enlace no abre nada", () => {
    expect(urlDeEnlace("alfa", "lvh.me", "TOK", "http://lvh.me:3000")).toBe(
      "http://alfa.lvh.me:3000/activar/TOK"
    );
  });

  it("sin slug cae al dominio base en vez de inventar un subdominio", () => {
    expect(urlDeEnlace(null, "chronoslead.com", "TOK", "https://chronoslead.com")).toBe(
      "https://chronoslead.com/activar/TOK"
    );
  });

  it("con APP_BASE_URL inutilizable usa https y sin puerto, que es lo correcto en producción", () => {
    expect(urlDeEnlace("alfa", "chronoslead.com", "TOK", "no-es-una-url")).toBe(
      "https://alfa.chronoslead.com/activar/TOK"
    );
  });

  it("el token va al final, nunca en la query: así no acaba en los logs del proxy", () => {
    const url = urlDeEnlace("alfa", "lvh.me", "TOK", "http://lvh.me:3000");
    expect(url).not.toContain("?");
    expect(url.endsWith("/activar/TOK")).toBe(true);
  });
});

describe("las constantes del enlace", () => {
  it("dura 7 días: el plazo que el operador ratificó", () => {
    expect(DIAS_DE_VALIDEZ).toBe(7);
  });

  it("exige el mismo mínimo que el registro, para no abrir una puerta más débil", () => {
    expect(MIN_LONGITUD_CONTRASENA).toBe(8);
  });
});
