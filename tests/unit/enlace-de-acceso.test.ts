import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..", "..");
const acciones = readFileSync(path.join(RAIZ, "src/app/admin/actions.ts"), "utf8");
const panel = readFileSync(path.join(RAIZ, "src/components/admin/padron.tsx"), "utf8");

/**
 * 133 — Los dos fallos del alta de The Student Store, el primer cliente real.
 *
 * Ninguno daba error: el alta decía que todo salió bien y el operador se
 * enteraba al intentar entrar y que lo devolviera al login sin decir nada.
 */
describe("el enlace de acceso sabe para quién es", () => {
  it("filtra por rol y no toma «el primer miembro»", () => {
    // Antes: `.limit(1)` sobre los miembros sin filtrar. Devolvía al dueño o
    // al soporte según cuál saliera primero de la base. Y como crear un
    // enlace invalida el anterior de esa persona, se podía dejar afuera al
    // cliente creyendo que uno se lo generaba a sí mismo.
    expect(acciones).toMatch(/schema\.member\.role,\s*rol/);
    expect(acciones).toMatch(/formData\.get\("para"\)/);
  });

  it("el panel ofrece los dos destinos, explícitos", () => {
    expect(panel).toContain('value="dueno"');
    expect(panel).toContain('value="soporte"');
    expect(panel).toContain("Para el dueño");
    expect(panel).toContain("Para soporte");
  });
});

describe("la cuenta de soporte puede entrar (133)", () => {
  it("el alta le genera su enlace cuando la crea nueva", () => {
    // Se creaba con `password: null` y sin enlace: una cuenta sin contraseña
    // y sin forma de ponerle una.
    expect(acciones).toMatch(/enlaceSoporte/);
    expect(acciones).toMatch(/userId:\s*soporteId!?,\s*motivo:\s*"alta"/);
  });

  it("NO le genera uno si ese correo ya era usuario", () => {
    // El mismo operador atiende a varios clientes con un solo correo:
    // generarle un enlace le invalidaría la contraseña que ya usa en los
    // demás. La condición es que el usuario NO existiera.
    expect(acciones).toMatch(/correoSoporte\s*&&\s*!soporte\[0\]/);
  });

  it("los dos enlaces se devuelven distinguidos", () => {
    // Si salieran pegados, el operador le manda al cliente el suyo.
    expect(acciones).toContain("SOPORTE");
  });
});
