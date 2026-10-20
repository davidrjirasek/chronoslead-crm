import { describe, expect, it } from "vitest";
import {
  DIRECTORIO_POR_DEFECTO,
  directorioDeEntregas,
} from "@/server/platform/entregas";

describe("dónde se escriben los enlaces de primer acceso", () => {
  it("sin variable, al lado del repo", () => {
    expect(directorioDeEntregas({})).toBe(DIRECTORIO_POR_DEFECTO);
  });

  it("en la imagen, al volumen: lo que debe sobrevivir al despliegue vive en /data", () => {
    expect(directorioDeEntregas({ PROVISION_DIR: "/data/.provision" })).toBe(
      "/data/.provision"
    );
  });

  it("una variable VACÍA cuenta como ausente, no como la raíz del disco", () => {
    // Los paneles inyectan VAR="" para las opcionales que nadie rellenó. Si eso
    // pasara tal cual, el enlace de un cliente acabaría escrito en `/`.
    expect(directorioDeEntregas({ PROVISION_DIR: "" })).toBe(DIRECTORIO_POR_DEFECTO);
    expect(directorioDeEntregas({ PROVISION_DIR: "   " })).toBe(DIRECTORIO_POR_DEFECTO);
    expect(directorioDeEntregas({ PROVISION_DIR: undefined })).toBe(
      DIRECTORIO_POR_DEFECTO
    );
  });

  it("recorta los espacios de alrededor", () => {
    expect(directorioDeEntregas({ PROVISION_DIR: "  /data/.provision  " })).toBe(
      "/data/.provision"
    );
  });
});
