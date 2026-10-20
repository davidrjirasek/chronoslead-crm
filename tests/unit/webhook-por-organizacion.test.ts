import { describe, expect, it } from "vitest";
import {
  segmentoDeOrganizacion,
  segmentoValido,
} from "@/server/whatsapp/webhook-segment";
import {
  puedeEscribirEn,
  type Procedencia,
} from "@/server/inbox/procedencia";

const CLAVE = "clave-maestra-de-prueba-no-es-un-secreto-real";
const OTRA_CLAVE = "otra-clave-maestra-distinta-de-la-primera";
const ORG_A = "org_aaaaaaaaaaaaaaaa";
const ORG_B = "org_bbbbbbbbbbbbbbbb";

describe("segmento firmado del webhook", () => {
  it("es determinista: misma entrada, misma firma", () => {
    expect(segmentoDeOrganizacion(ORG_A, 1, CLAVE)).toBe(
      segmentoDeOrganizacion(ORG_A, 1, CLAVE)
    );
  });

  it("es distinto para cada organización", () => {
    expect(segmentoDeOrganizacion(ORG_A, 1, CLAVE)).not.toBe(
      segmentoDeOrganizacion(ORG_B, 1, CLAVE)
    );
  });

  it("cambia al subir la versión: así se rota la URL de UNA organización", () => {
    expect(segmentoDeOrganizacion(ORG_A, 1, CLAVE)).not.toBe(
      segmentoDeOrganizacion(ORG_A, 2, CLAVE)
    );
  });

  it("rotar una organización no cambia la firma de otra", () => {
    const bAntes = segmentoDeOrganizacion(ORG_B, 1, CLAVE);
    segmentoDeOrganizacion(ORG_A, 99, CLAVE);
    expect(segmentoDeOrganizacion(ORG_B, 1, CLAVE)).toBe(bAntes);
  });

  it("depende de la clave maestra de la instancia", () => {
    expect(segmentoDeOrganizacion(ORG_A, 1, CLAVE)).not.toBe(
      segmentoDeOrganizacion(ORG_A, 1, OTRA_CLAVE)
    );
  });

  it("es seguro en una URL (base64url, sin / ni + ni =)", () => {
    expect(segmentoDeOrganizacion(ORG_A, 1, CLAVE)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("validación del segmento", () => {
  it("acepta el suyo", () => {
    const firma = segmentoDeOrganizacion(ORG_A, 1, CLAVE);
    expect(segmentoValido(ORG_A, 1, CLAVE, firma)).toBe(true);
  });

  it("RECHAZA la firma de otra organización", () => {
    const firmaDeB = segmentoDeOrganizacion(ORG_B, 1, CLAVE);
    expect(segmentoValido(ORG_A, 1, CLAVE, firmaDeB)).toBe(false);
  });

  it("RECHAZA la firma de una versión anterior tras rotar", () => {
    const vieja = segmentoDeOrganizacion(ORG_A, 1, CLAVE);
    expect(segmentoValido(ORG_A, 2, CLAVE, vieja)).toBe(false);
  });

  it("rechaza vacío, nulo y basura sin lanzar", () => {
    expect(segmentoValido(ORG_A, 1, CLAVE, "")).toBe(false);
    expect(segmentoValido(ORG_A, 1, CLAVE, null)).toBe(false);
    expect(segmentoValido(ORG_A, 1, CLAVE, undefined)).toBe(false);
    expect(segmentoValido(ORG_A, 1, CLAVE, "loquesea")).toBe(false);
  });

  it("una firma más larga o más corta no revienta la comparación", () => {
    const firma = segmentoDeOrganizacion(ORG_A, 1, CLAVE);
    expect(segmentoValido(ORG_A, 1, CLAVE, firma + "x")).toBe(false);
    expect(segmentoValido(ORG_A, 1, CLAVE, firma.slice(0, -1))).toBe(false);
  });
});

describe("guardián de procedencia", () => {
  const porPuertaDeA: Procedencia = { via: "organizacion", organizationId: ORG_A };

  it("la puerta de A puede escribir en A", () => {
    expect(puedeEscribirEn(porPuertaDeA, ORG_A)).toBe(true);
  });

  it("la puerta de A NO puede escribir en B aunque el cuerpo lo pida", () => {
    expect(puedeEscribirEn(porPuertaDeA, ORG_B)).toBe(false);
  });

  it("la puerta compartida (un solo negocio) y la interna sí pueden", () => {
    expect(puedeEscribirEn({ via: "legacy" }, ORG_A)).toBe(true);
    expect(puedeEscribirEn({ via: "interna" }, ORG_B)).toBe(true);
  });
});
