import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTenantFromHost } from "@/lib/tenant/host";

const RAIZ = path.resolve(__dirname, "..", "..");
const pagina = readFileSync(path.join(RAIZ, "src/app/cuentas/page.tsx"), "utf8");
const lista = readFileSync(path.join(RAIZ, "src/components/cuentas/lista.tsx"), "utf8");

/**
 * 138 — El lanzador: una dirección en vez de nueve.
 *
 * Nadie recuerda la dirección de cada cliente. Con nueve ya molesta; con
 * cincuenta es imposible.
 */
describe("138 · el host del lanzador", () => {
  it("`cuentas.` resuelve a su propia puerta, no a un cliente", () => {
    expect(resolveTenantFromHost("cuentas.chronoslead.com", "chronoslead.com")).toEqual({
      kind: "cuentas",
    });
  });

  it("y no se puede dar de alta un cliente con ese identificador", () => {
    // Está en reservados como segunda cerradura: si la rama de arriba
    // desapareciera, el host caería en «no existe» en vez de en un cliente.
    expect(resolveTenantFromHost("cuentas.ejemplo.test", "ejemplo.test").kind).not.toBe(
      "tenant"
    );
  });

  it("las demás puertas siguen donde estaban", () => {
    const base = "chronoslead.com";
    expect(resolveTenantFromHost(`admin.${base}`, base).kind).toBe("admin");
    expect(resolveTenantFromHost(`onboarding.${base}`, base).kind).toBe("onboarding");
    expect(resolveTenantFromHost(base, base).kind).toBe("landing");
    expect(resolveTenantFromHost(`cerritos.${base}`, base)).toEqual({
      kind: "tenant",
      slug: "cerritos",
    });
  });
});

describe("138 · qué muestra y qué no", () => {
  it("exige sesión: una lista pública regalaría la cartera", () => {
    expect(pagina).toMatch(/getSession\(/);
    expect(pagina).toMatch(/if \(!sesion\) redirect\("\/login"\)/);
  });

  it("la lista sale de las membresías de QUIEN entró", () => {
    expect(pagina).toMatch(/misOrganizaciones\(sesion\.user\.id\)/);
  });

  it("no LLAMA a requireSession: ese host no es de un cliente", () => {
    // El comentario de la página la nombra para explicar por qué no la usa,
    // así que buscar la palabra suelta da un falso positivo: se busca la
    // llamada y el import.
    expect(pagina).not.toMatch(/await requireSession\(/);
    expect(pagina).not.toMatch(/import \{[^}]*requireSession/);
  });

  it("cada fila es un enlace, no un pase: el destino pide contraseña", () => {
    expect(lista).toMatch(/href=\{`\$\{protocolo\}:\/\/\$\{o\.slug\}\./);
    expect(lista).toContain("las sesiones se guardan por dirección");
  });

  it("sin organizaciones no deja una pantalla muda", () => {
    expect(lista).toContain("todavía no pertenece a ninguna");
  });
});
