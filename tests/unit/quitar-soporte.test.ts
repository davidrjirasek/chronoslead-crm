import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..", "..");
const acciones = readFileSync(path.join(RAIZ, "src/app/admin/actions.ts"), "utf8");
const panel = readFileSync(path.join(RAIZ, "src/components/admin/padron.tsx"), "utf8");
const gobierno = readFileSync(path.join(RAIZ, "src/server/equipo/gobierno.ts"), "utf8");

/**
 * 137 — Sumar sin poder quitar es una puerta de una sola dirección.
 *
 * La regla de rangos impide que un administrador toque a otro, así que cuando
 * alguien de la agencia se va, NADIE de la agencia puede sacarlo: el único con
 * rango es el propietario de cada cliente. Había que pedirle al cliente que
 * echara a nuestro propio empleado de su empresa.
 */
describe("quitar soporte desde la plataforma (137)", () => {
  it("existe la acción, al lado de la de sumar", () => {
    expect(acciones).toMatch(/export async function quitarSoporteDeCliente/);
    expect(acciones).toMatch(/export async function sumarSoporteACliente/);
  });

  it("exige superadmin, como todas las del panel", () => {
    const fn = acciones.slice(acciones.indexOf("export async function quitarSoporteDeCliente"));
    expect(fn).toMatch(/exigirSuperadmin\(\)/);
  });

  it("al PROPIETARIO no se lo quita: la cuenta quedaría sin dueño", () => {
    expect(gobierno).toContain('destino.role === "owner"');
    expect(gobierno).toContain("La cuenta quedaría sin dueño");
  });

  it("borra la membresía, no la persona", () => {
    const fn = gobierno.slice(gobierno.indexOf("export async function quitarComoPlataforma"));
    expect(fn).toMatch(/delete\(schema\.member\)/);
    expect(fn).not.toMatch(/delete\(schema\.user\)/);
  });

  it("y le cierra las sesiones abiertas", () => {
    const fn = gobierno.slice(gobierno.indexOf("export async function quitarComoPlataforma"));
    expect(fn).toMatch(/delete\(schema\.session\)/);
  });

  it("resuelve al objetivo DENTRO de la organización indicada", () => {
    // Un memberId de otro cliente no se encuentra: mismo 404 que uno inventado.
    const fn = gobierno.slice(gobierno.indexOf("export async function quitarComoPlataforma"));
    expect(fn).toMatch(/objetivo\(input\.organizationId, input\.memberId\)/);
  });

  it("queda en la bitácora que el cliente ve", () => {
    const fn = gobierno.slice(gobierno.indexOf("export async function quitarComoPlataforma"));
    expect(fn).toMatch(/accion: "baja"/);
    expect(fn).toContain("panel de plataforma");
  });

  it("el panel lista a cada miembro con su baja, salvo el propietario", () => {
    expect(panel).toContain('name="memberId"');
    expect(panel).toContain('m.rol === "owner"');
    expect(panel).toContain("Quitar");
  });
});
