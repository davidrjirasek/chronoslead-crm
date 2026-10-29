import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..", "..");
const leer = (p: string) => readFileSync(path.join(RAIZ, p), "utf8");

/**
 * 132 — Del panel de operador se tiene que poder salir.
 *
 * Existe porque NO se podía: el cierre de sesión vivía solo en el CRM y el
 * panel no tenía ninguno. Lo detectó el dueño preguntando cómo se desloguea,
 * y la única respuesta era borrar las cookies del sitio a mano.
 */
describe("salir del panel de operador", () => {
  it("el botón cierra la sesión de verdad, no solo navega", () => {
    // Mandar a /login sin cerrar sesión deja entrar de nuevo con volver atrás:
    // parece que salió y no salió.
    const fuente = leer("src/components/admin/salir.tsx");
    expect(fuente).toContain("signOut");
    expect(fuente).toMatch(/signOut\(\)/);
  });

  it("refresca después de salir", () => {
    // Sin `refresh`, la pantalla del panel queda pintada en caché y el
    // operador cree que su sesión sigue viva.
    expect(leer("src/components/admin/salir.tsx")).toContain("router.refresh()");
  });

  it("está en las dos pantallas del panel", () => {
    for (const p of [
      "src/components/admin/padron.tsx",
      "src/components/admin/cuestionarios.tsx",
    ]) {
      expect(leer(p), p).toContain("<Salir />");
    }
  });
});
