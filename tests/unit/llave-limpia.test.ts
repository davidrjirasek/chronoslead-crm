import { describe, expect, it } from "vitest";
import { limpiarLlave, pareceLlaveDe } from "@/lib/ai/presets";
import { aiSettingsPutSchema } from "@/server/ai/settings";

/**
 * 154 — La llave se limpia antes de guardarse.
 *
 * El 25-nov-2026 el agente de Creativo 4D Group quedó mudo. OpenRouter
 * contestaba 401 `Missing Authentication header` —«la cabecera llegó
 * malformada», no «la llave no sirve»— y la MISMA llave, probada a mano
 * desde la terminal, funcionaba.
 *
 * Lo que engañaba: la pantalla decía «Activo», los últimos 4 coincidían, y
 * la diferencia estaba en un carácter invisible EN EL MEDIO, donde el
 * `.trim()` no mira. Se cifraba sucia y el error recién aparecía al usarla.
 *
 * Por eso lo que se prueba acá no es que limpie espacios —eso es fácil—,
 * sino que limpie los que NO cuentan como espacio para JavaScript.
 */

const BUENA = "sk-or-v1-" + "a".repeat(64);

describe("limpiar la llave", () => {
  it("una llave sana no se toca", () => {
    expect(limpiarLlave(BUENA)).toBe(BUENA);
  });

  it("espacios en las puntas, como ya hacía trim", () => {
    expect(limpiarLlave(`  ${BUENA}\n`)).toBe(BUENA);
  });

  it("y un espacio EN EL MEDIO, que es el que rompía", () => {
    expect(limpiarLlave("sk-or-v1- abc")).toBe("sk-or-v1-abc");
  });

  it("el espacio de ancho cero: invisible y trim no lo ve", () => {
    // Es el que se cuela al copiar desde una página web.
    expect(limpiarLlave("sk-or-v1-​abc")).toBe("sk-or-v1-abc");
  });

  it("el espacio duro, el BOM y la marca de dirección", () => {
    expect(limpiarLlave("sk- or﻿-v1‎-abc")).toBe(
      "sk-or-v1-abc"
    );
  });

  it("un salto de línea pegado desde un panel de despliegue", () => {
    expect(limpiarLlave("sk-or-v1-\r\nabc")).toBe("sk-or-v1-abc");
  });

  it("el guion suave, que se ve como nada", () => {
    expect(limpiarLlave("sk-or­-v1-abc")).toBe("sk-or-v1-abc");
  });

  it("no inventa ni recorta nada más", () => {
    expect(limpiarLlave("")).toBe("");
    expect(limpiarLlave("sk-or-v1-ABC_123-xyz")).toBe("sk-or-v1-ABC_123-xyz");
  });
});

describe("el esquema que guarda", () => {
  const base = { provider: "openrouter" as const, model: "x/y" };

  it("guarda la llave ya limpia, no la sucia", () => {
    const r = aiSettingsPutSchema.safeParse({
      ...base,
      token: ` ${BUENA.slice(0, 20)}​${BUENA.slice(20)} `,
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.token).toBe(BUENA);
  });

  it("sin llave sigue valiendo: cambiar de modelo no pide pegarla de nuevo", () => {
    expect(aiSettingsPutSchema.safeParse(base).success).toBe(true);
  });

  it("algo que al limpiarlo queda en nada no pasa por llave", () => {
    expect(
      aiSettingsPutSchema.safeParse({ ...base, token: "        " }).success
    ).toBe(false);
  });
});

describe("el aviso de forma", () => {
  it("una llave de OpenRouter se reconoce", () => {
    expect(pareceLlaveDe("openrouter", BUENA)).toBe(true);
  });

  it("y una copiada a medias, no", () => {
    expect(pareceLlaveDe("openrouter", "v1-abcdef")).toBe(false);
  });

  it("con la suciedad puesta igual la reconoce: avisa por la forma, no por el ruido", () => {
    expect(pareceLlaveDe("openrouter", ` sk​-or-v1-abc`)).toBe(true);
  });

  it("con otro proveedor no opina: cada uno tiene su formato", () => {
    expect(pareceLlaveDe("openai_compatible", "lo-que-sea")).toBe(true);
  });
});
