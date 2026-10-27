import { describe, expect, it } from "vitest";
import { direccionDe, interpretar } from "@/server/platform/salud";

/**
 * 123 — La comprobación de direcciones del panel.
 *
 * Existe para atrapar el paso que más se olvida al dar de alta: agregar el
 * subdominio del cliente en Coolify. Sin eso, su dirección devuelve 503 y la
 * aplicación ni se entera, así que no hay registro donde mirarlo.
 */
describe("cómo se lee lo que contesta una dirección", () => {
  it("200 es la única respuesta buena", () => {
    expect(interpretar(200)).toBe("ok");
  });

  it("503 significa que falta el dominio en Coolify", () => {
    // Es el caso que justifica toda esta función.
    expect(interpretar(503)).toBe("sin_dominio");
  });

  it("sin respuesta es sin respuesta, no «apagado»", () => {
    // Puede ser el servidor, puede ser la red desde donde se mira. Decir cuál
    // sería adivinar, y un panel que adivina enseña a desconfiar de él.
    expect(interpretar(null)).toBe("sin_respuesta");
  });

  it("cualquier otro código se muestra tal cual", () => {
    for (const c of [301, 404, 500, 502]) {
      expect(interpretar(c)).toBe("otro");
    }
  });
});

describe("cómo se arma la dirección que se consulta", () => {
  it("en producción: https y sin puerto", () => {
    expect(direccionDe("sonrisa", "chronoslead.com", "https://chronoslead.com")).toBe(
      "https://sonrisa.chronoslead.com/api/health"
    );
  });

  it("en desarrollo toma el protocolo y el puerto de APP_BASE_URL", () => {
    // Armar siempre https sin puerto daba una dirección que no existe en la
    // máquina de quien lo construye: el panel mentía en rojo, y un panel que
    // miente es un panel que se deja de mirar.
    expect(direccionDe("sonrisa", "lvh.me", "http://lvh.me:3000")).toBe(
      "http://sonrisa.lvh.me:3000/api/health"
    );
  });

  it("sin APP_BASE_URL utilizable cae en lo de producción", () => {
    expect(direccionDe("sonrisa", "chronoslead.com", "")).toBe(
      "https://sonrisa.chronoslead.com/api/health"
    );
    expect(direccionDe("sonrisa", "chronoslead.com", "no-es-una-url")).toBe(
      "https://sonrisa.chronoslead.com/api/health"
    );
  });
});
