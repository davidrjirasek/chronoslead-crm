import { describe, expect, it } from "vitest";
import {
  esViolacionDeUnico,
  mensajeDeCuentaYaConectada,
} from "@/server/channels/cuenta-ya-conectada";

/**
 * 144 — Traducir el choque de cuentas entre clientes.
 *
 * El caso real: el dueño intentó conectar Messenger en un cliente, su llave
 * de Zernio resolvió a la ÚNICA cuenta de Facebook que tenía —la de la
 * agencia— y esa página ya vivía en otra organización. El índice único hizo
 * su trabajo; la pantalla dijo «error interno» y escondió el motivo.
 */

/** Un error de Postgres como lo deja el driver. */
function postgres(constraint: string, detalle = "") {
  return {
    code: "23505",
    constraint_name: constraint,
    detail: detalle,
    message: `duplicate key value violates unique constraint "${constraint}"`,
  };
}

/** El mismo error, pero envuelto por Drizzle: el código viaja en `cause`. */
function envuelto(constraint: string) {
  return { message: "error de base de datos", cause: postgres(constraint) };
}

describe("detectar la violación de índice único", () => {
  it("la reconoce directa", () => {
    expect(esViolacionDeUnico(postgres("messenger_credentials_page_uq"))).toBe(
      true
    );
  });

  it("y envuelta por Drizzle, que es como llega de verdad", () => {
    expect(esViolacionDeUnico(envuelto("messenger_credentials_page_uq"))).toBe(
      true
    );
  });

  it("no confunde otros errores", () => {
    expect(esViolacionDeUnico(new Error("se cayó la red"))).toBe(false);
    expect(esViolacionDeUnico({ code: "23503" })).toBe(false);
    expect(esViolacionDeUnico(null)).toBe(false);
    expect(esViolacionDeUnico("23505")).toBe(false);
  });
});

describe("el mensaje para el dueño", () => {
  it("nombra QUÉ está tomado, no solo que algo falló", () => {
    const m = mensajeDeCuentaYaConectada(
      postgres("messenger_credentials_page_uq", "Key (page_id)=(1) already exists.")
    );
    expect(m).toContain("Esa página de Facebook");
    expect(m).toContain("otra instancia");
  });

  it("distingue los cuatro canales", () => {
    const casos: [string, string][] = [
      ["instagram_credentials_ig_user_uq", "Esa cuenta de Instagram"],
      ["meta_credentials_phone_uq", "Ese número de WhatsApp"],
      ["tiktok_credentials_account_ref_uq", "Esa cuenta de TikTok"],
    ];
    for (const [constraint, esperado] of casos) {
      expect(mensajeDeCuentaYaConectada(postgres(constraint))).toContain(
        esperado
      );
    }
  });

  it("dentro de WhatsApp distingue el número de la cuenta de Zernio", () => {
    // No es lo mismo chocar con otro número que con otra cuenta de Zernio, y
    // decir cuál de las dos es la diferencia entre entender y adivinar.
    const porNumero = mensajeDeCuentaYaConectada(
      postgres("meta_credentials_phone_uq")
    );
    const porCuenta = mensajeDeCuentaYaConectada(
      postgres("meta_credentials_account_ref_uq")
    );
    expect(porNumero).toContain("Ese número de WhatsApp");
    expect(porCuenta).toContain("Esa cuenta de WhatsApp de Zernio");
    expect(porNumero).not.toBe(porCuenta);
  });

  it("sugiere la salida: pegar el identificador a mano", () => {
    const m = mensajeDeCuentaYaConectada(
      postgres("instagram_credentials_ig_user_uq")
    );
    expect(m).toContain("identificador");
  });

  it("funciona con el error envuelto por Drizzle", () => {
    expect(
      mensajeDeCuentaYaConectada(envuelto("messenger_credentials_page_uq"))
    ).toContain("Esa página de Facebook");
  });
});

describe("lo que NO tapa", () => {
  it("reconectar la misma organización no es este error", () => {
    // `*_org_uq` salta cuando la organización ya tenía conexión: eso lo
    // resuelve el guardado solo, y confundirlo con un choque entre clientes
    // mandaría al dueño a buscar un problema que no existe.
    expect(
      mensajeDeCuentaYaConectada(postgres("messenger_credentials_org_uq"))
    ).toBeNull();
  });

  it("una restricción desconocida sigue siendo un error de verdad", () => {
    // Devolver null hace que el error suba tal cual. Taparlo todo con una
    // frase amable escondería fallos reales.
    expect(mensajeDeCuentaYaConectada(postgres("tabla_nueva_uq"))).toBeNull();
  });

  it("un error que no es de unicidad pasa de largo", () => {
    expect(mensajeDeCuentaYaConectada(new Error("timeout"))).toBeNull();
  });
});
