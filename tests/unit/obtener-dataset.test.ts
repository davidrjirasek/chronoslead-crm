import { beforeEach, describe, expect, it, vi } from "vitest";

const getCredentialsByOrg = vi.hoisted(() => vi.fn());
const graphRequest = vi.hoisted(() => vi.fn());

vi.mock("@/server/whatsapp/credentials", () => ({ getCredentialsByOrg }));
vi.mock("@/lib/meta/client", () => ({ graphRequest }));

import { obtenerDatasetDelNegocio } from "@/server/attribution/dataset";

const CRED = {
  id: "cred_1",
  organizationId: "org_1",
  wabaId: "3979964855646808",
  phoneNumberId: "pn_1",
  displayPhoneNumber: null,
  verifiedName: null,
  status: "connected" as const,
  token: "EAAG-secreto-del-negocio",
};

/**
 * 135 — El CRM pide el conjunto de datos a Meta.
 *
 * Existe porque ese número no se puede conseguir por la interfaz de Meta: el
 * Administrador de eventos muestra píxeles web y el de WhatsApp puede no
 * existir todavía.
 */
describe("obtener el conjunto de datos", () => {
  beforeEach(() => {
    getCredentialsByOrg.mockReset();
    graphRequest.mockReset();
  });

  it("lo pide a la cuenta de WhatsApp del negocio, con POST", () => {
    // POST y no GET: del lado de Meta CREA el conjunto si no existe.
    getCredentialsByOrg.mockResolvedValue(CRED);
    graphRequest.mockResolvedValue({ id: "1708105527110154" });
    return obtenerDatasetDelNegocio("org_1").then((r) => {
      expect(r).toEqual({ ok: true, datasetId: "1708105527110154" });
      expect(graphRequest).toHaveBeenCalledWith(
        "3979964855646808/dataset",
        expect.objectContaining({ method: "POST", token: CRED.token })
      );
    });
  });

  it("sin WhatsApp conectado explica qué hacer, no da un error técnico", async () => {
    // Es la causa más probable y la persona puede resolverla sola.
    getCredentialsByOrg.mockResolvedValue(null);
    const r = await obtenerDatasetDelNegocio("org_1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("sin_whatsapp");
    expect(r.detalle).toMatch(/Ajustes → WhatsApp/);
  });

  it("si falta el permiso lo dice, y deja el camino manual", async () => {
    // Es el riesgo conocido: 016 asume permiso para PUBLICAR, y crearlo puede
    // pedir whatsapp_business_management.
    getCredentialsByOrg.mockResolvedValue(CRED);
    graphRequest.mockRejectedValue(new Error("(#200) Permissions error"));
    const r = await obtenerDatasetDelNegocio("org_1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("sin_permiso");
    expect(r.detalle).toMatch(/a mano/);
  });

  it("el token del negocio NUNCA viaja en la respuesta", async () => {
    // Meta puede devolver el token dentro del mensaje de error.
    getCredentialsByOrg.mockResolvedValue(CRED);
    graphRequest.mockRejectedValue(new Error(`falló con token=${CRED.token}`));
    const r = await obtenerDatasetDelNegocio("org_1");
    expect(JSON.stringify(r)).not.toContain(CRED.token);
  });

  it("el token tampoco queda escrito en el registro", async () => {
    // Constitución I: jamás al cliente NI A LOGS. Se descubrió porque la
    // prueba de arriba lo imprimió en la salida de la consola.
    getCredentialsByOrg.mockResolvedValue(CRED);
    graphRequest.mockRejectedValue(new Error(`falló con token=${CRED.token}`));
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    await obtenerDatasetDelNegocio("org_1");
    const escrito = espia.mock.calls.flat().join(" ");
    expect(escrito).not.toContain(CRED.token);
    // Pero algo queda, para poder diagnosticar: los últimos cuatro.
    expect(escrito).toContain(CRED.token.slice(-4));
    espia.mockRestore();
  });

  it("una respuesta sin id no se toma por buena", async () => {
    getCredentialsByOrg.mockResolvedValue(CRED);
    graphRequest.mockResolvedValue({});
    const r = await obtenerDatasetDelNegocio("org_1");
    expect(r.ok).toBe(false);
  });
});
