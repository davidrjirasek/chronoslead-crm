import { describe, expect, it } from "vitest";
import {
  normalizarHost,
  resolveTenantFromHost,
  SLUGS_RESERVADOS,
} from "@/lib/tenant/host";

const PROD = "chronoslead.com";
const LOCAL = "lvh.me";

describe("normalizarHost", () => {
  it("baja a minúsculas y quita el punto final del FQDN", () => {
    expect(normalizarHost("DEMO.ChronosLead.com.")).toBe("demo.chronoslead.com");
  });

  it("quita el puerto", () => {
    expect(normalizarHost("demo.lvh.me:3000")).toBe("demo.lvh.me");
  });

  it("conserva el corchete de IPv6 sin confundir sus dos puntos con un puerto", () => {
    expect(normalizarHost("[::1]:3000")).toBe("[::1]");
  });

  it("devuelve cadena vacía para ausente", () => {
    expect(normalizarHost(null)).toBe("");
    expect(normalizarHost(undefined)).toBe("");
    expect(normalizarHost("")).toBe("");
  });
});

describe("resolveTenantFromHost — organizaciones", () => {
  it("resuelve el subdominio como slug de organización", () => {
    expect(resolveTenantFromHost("demo.chronoslead.com", PROD)).toEqual({
      kind: "tenant",
      slug: "demo",
    });
  });

  it("resuelve pese a mayúsculas y punto final", () => {
    expect(resolveTenantFromHost("DEMO.ChronosLead.com.", PROD)).toEqual({
      kind: "tenant",
      slug: "demo",
    });
  });

  it("resuelve en local, con puerto", () => {
    expect(resolveTenantFromHost("demo.lvh.me:3000", LOCAL)).toEqual({
      kind: "tenant",
      slug: "demo",
    });
  });

  it("acepta guiones interiores y dígitos", () => {
    expect(resolveTenantFromHost("castell-muebles2.chronoslead.com", PROD)).toEqual({
      kind: "tenant",
      slug: "castell-muebles2",
    });
  });

  it("no reserva `demo`: es el nombre natural de una organización de prueba", () => {
    expect(SLUGS_RESERVADOS.has("demo")).toBe(false);
  });
});

describe("resolveTenantFromHost — puertas de la plataforma", () => {
  it("el apex es la landing", () => {
    expect(resolveTenantFromHost(PROD, PROD)).toEqual({ kind: "landing" });
  });

  it("www es la landing, no una organización llamada www", () => {
    expect(resolveTenantFromHost("www.chronoslead.com", PROD)).toEqual({
      kind: "landing",
    });
  });

  it("admin y alta son puertas propias", () => {
    expect(resolveTenantFromHost("admin.chronoslead.com", PROD)).toEqual({
      kind: "admin",
    });
    expect(resolveTenantFromHost("alta.chronoslead.com", PROD)).toEqual({
      kind: "alta",
    });
  });
});

describe("resolveTenantFromHost — lo que NO puede caer en un tenant", () => {
  const desconocidos: Array<[string, string]> = [
    ["a.b.chronoslead.com", "más de un nivel"],
    ["api.chronoslead.com", "slug reservado"],
    ["cdn.chronoslead.com", "slug reservado"],
    ["-x.chronoslead.com", "guion al inicio"],
    ["x-.chronoslead.com", "guion al final"],
    ["a.chronoslead.com", "slug de un solo carácter"],
    ["chronoslead.com.evil.com", "dominio ajeno que contiene el base"],
    ["otro.com", "dominio ajeno"],
    ["evilchronoslead.com", "sufijo sin el punto separador"],
  ];

  for (const [host, motivo] of desconocidos) {
    it(`${host} → desconocido (${motivo})`, () => {
      expect(resolveTenantFromHost(host, PROD)).toEqual({ kind: "desconocido" });
    });
  }

  it("host ausente o base ausente → desconocido, nunca un tenant", () => {
    expect(resolveTenantFromHost(null, PROD)).toEqual({ kind: "desconocido" });
    expect(resolveTenantFromHost("demo.chronoslead.com", "")).toEqual({
      kind: "desconocido",
    });
  });
});

describe("125 — el subdominio del panel de despliegue", () => {
  it("«coolify» está reservado: ahí vive el panel, no un cliente", () => {
    // Coolify pasa a `coolify.chronoslead.com` con HTTPS, en vez del puerto
    // 8000 expuesto. Sin reservarlo, ese cliente se crearía bien y NUNCA
    // podría entrar: el proxy le da prioridad al panel y no hay error que lo
    // explique. Lo detectó una pregunta del dueño sobre por qué va ahí.
    expect(
      resolveTenantFromHost("coolify.chronoslead.com", "chronoslead.com").kind
    ).toBe("desconocido");
  });
});
