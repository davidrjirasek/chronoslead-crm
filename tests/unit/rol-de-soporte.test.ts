import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canConfigure } from "@/lib/auth/roles";

const RAIZ = path.resolve(__dirname, "..", "..");

/**
 * 121 — El administrador de soporte.
 *
 * El cliente es el PROPIETARIO de su cuenta; quien la configura entra como
 * `admin`. Antes `admin` existía en el código pero no lo asignaba nadie, y
 * nueve rutas exigían ser `owner` exactamente — así que un admin no podía
 * tocar marca, canales ni equipo.
 */
describe("quién puede configurar", () => {
  it("el propietario y el administrador sí", () => {
    expect(canConfigure("owner")).toBe(true);
    expect(canConfigure("admin")).toBe(true);
  });

  it("un miembro NO: atiende la Bandeja y nada más", () => {
    expect(canConfigure("member")).toBe(false);
  });

  it("un rol desconocido o ausente NO", () => {
    // El valor por defecto es negar: un rol que no entendemos no configura.
    expect(canConfigure("invitado")).toBe(false);
    expect(canConfigure(null)).toBe(false);
    expect(canConfigure(undefined)).toBe(false);
    expect(canConfigure("")).toBe(false);
  });
});

describe("ninguna ruta de ajustes vuelve a exigir «owner» a secas", () => {
  /**
   * Se revisa el código fuente a propósito: el fallo que esto previene es que
   * alguien agregue una ruta nueva copiando el control viejo, y el
   * administrador de soporte quede afuera de una pantalla sin que nadie lo
   * note hasta que falle en vivo.
   */
  const RUTAS = [
    "branding/route.ts",
    "branding/favicon/route.ts",
    "channels/route.ts",
    "instagram/route.ts",
    "messenger/route.ts",
    "team/route.ts",
    "tiktok/route.ts",
  ];

  for (const ruta of RUTAS) {
    it(`${ruta} usa canConfigure`, () => {
      const fuente = readFileSync(
        path.join(RAIZ, "src", "app", "api", "settings", ruta),
        "utf8"
      );
      expect(fuente).toContain("canConfigure");
      expect(fuente).not.toMatch(/role\s*!==\s*"owner"/);
      expect(fuente).not.toMatch(/role\s*===\s*"owner"/);
    });
  }
});

describe("el alta crea los dos usuarios", () => {
  const fuente = readFileSync(
    path.join(RAIZ, "src", "app", "admin", "actions.ts"),
    "utf8"
  );

  it("el cliente queda como propietario de su propia cuenta", () => {
    expect(fuente).toMatch(/userId,\s*\n\s*role: "owner"/);
  });

  it("y el soporte como administrador, no como propietario", () => {
    expect(fuente).toMatch(/userId: soporteId,\s*\n\s*role: "admin"/);
  });

  it("los dos en la MISMA transacción: un alta a medias no sirve", () => {
    const tx = fuente.slice(
      fuente.indexOf("await db.transaction"),
      fuente.indexOf("const { token } = await crearEnlace")
    );
    expect(tx).toContain('role: "owner"');
    expect(tx).toContain('role: "admin"');
  });

  it("el correo de soporte es opcional en el código", () => {
    // Obligatorio en el procedimiento (docs/alta-de-cliente.md), opcional
    // aquí: así las altas anteriores y las pruebas siguen funcionando.
    expect(fuente).toMatch(/correoSoporte:[\s\S]{0,200}\.optional\(\)/);
  });

  it("y no puede ser el mismo que el del dueño", () => {
    expect(fuente).toContain("correoSoporte === correo");
  });
});

describe("crear una cuenta de equipo", () => {
  const fuente = readFileSync(
    path.join(RAIZ, "src", "app", "api", "settings", "team", "route.ts"),
    "utf8"
  );

  it("acepta elegir entre miembro y administrador", () => {
    expect(fuente).toMatch(/rol: z\.enum\(\["member", "admin"\]\)/);
  });

  it("NO ofrece «owner»: el dueño de la cuenta se fija en el alta", () => {
    expect(fuente).not.toMatch(/z\.enum\(\[[^\]]*"owner"/);
  });

  it("por defecto crea un miembro, que es el permiso más chico", () => {
    expect(fuente).toMatch(/\.default\("member"\)/);
  });
});
