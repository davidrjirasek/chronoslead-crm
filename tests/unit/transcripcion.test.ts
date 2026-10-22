import { describe, expect, it } from "vitest";
import {
  configDeTranscripcion,
  cuerpoDeTranscripcion,
  nombreDeArchivo,
  transcripcionDisponible,
  urlDeTranscripcion,
} from "@/server/ai/transcripcion";

describe("el conector de transcripción", () => {
  describe("está apagado salvo que alguien lo encienda", () => {
    it("sin variables, apagado", () => {
      expect(configDeTranscripcion({}).activa).toBe(false);
      expect(transcripcionDisponible(configDeTranscripcion({}))).toBe(false);
    });

    it("encendido pero SIN llave no está disponible: no sirve a medias", () => {
      const cfg = configDeTranscripcion({ TRANSCRIPCION: "on" });
      expect(cfg.activa).toBe(true);
      expect(transcripcionDisponible(cfg)).toBe(false);
    });

    it("encendido y con llave, disponible", () => {
      const cfg = configDeTranscripcion({
        TRANSCRIPCION: "on",
        TRANSCRIPCION_API_KEY: "k-123",
      });
      expect(transcripcionDisponible(cfg)).toBe(true);
    });

    it("cualquier valor que no sea `on` deja el conector apagado", () => {
      for (const v of ["true", "1", "si", "yes", "ON ", ""]) {
        const cfg = configDeTranscripcion({ TRANSCRIPCION: v });
        // `ON ` con espacio sí enciende: se recorta y se compara en minúsculas.
        expect(cfg.activa).toBe(v.trim().toLowerCase() === "on");
      }
    });
  });

  describe("la URL del proveedor", () => {
    it("se arma sobre la base, con o sin barra final", () => {
      expect(urlDeTranscripcion("https://api.groq.com/openai/v1")).toBe(
        "https://api.groq.com/openai/v1/audio/transcriptions"
      );
      expect(urlDeTranscripcion("https://api.groq.com/openai/v1///")).toBe(
        "https://api.groq.com/openai/v1/audio/transcriptions"
      );
    });
  });

  describe("el nombre del archivo", () => {
    it("conserva la extensión: varios proveedores deciden el formato por ahí", () => {
      // WhatsApp manda `audio/ogg; codecs=opus`.
      expect(nombreDeArchivo("audio/ogg; codecs=opus")).toBe("nota-de-voz.ogg");
      expect(nombreDeArchivo("audio/mpeg")).toBe("nota-de-voz.mp3");
      expect(nombreDeArchivo("audio/mp4")).toBe("nota-de-voz.m4a");
      expect(nombreDeArchivo("audio/wav")).toBe("nota-de-voz.wav");
    });

    it("un mime desconocido cae en ogg, que es lo que manda WhatsApp", () => {
      expect(nombreDeArchivo("application/octet-stream")).toBe("nota-de-voz.ogg");
      expect(nombreDeArchivo("")).toBe("nota-de-voz.ogg");
    });
  });

  describe("lo que se le manda al proveedor", () => {
    const cfg = configDeTranscripcion({
      TRANSCRIPCION: "on",
      TRANSCRIPCION_API_KEY: "k-123",
      TRANSCRIPCION_MODEL: "whisper-large-v3-turbo",
    });

    it("lleva el archivo, el modelo y el idioma", () => {
      const fd = cuerpoDeTranscripcion(
        new Uint8Array([1, 2, 3]),
        "audio/ogg; codecs=opus",
        cfg
      );
      expect(fd.get("model")).toBe("whisper-large-v3-turbo");
      expect(fd.get("language")).toBe("es");
      const file = fd.get("file");
      expect(file).toBeInstanceOf(Blob);
    });

    it("sin idioma configurado no se manda el campo", () => {
      const sinIdioma = configDeTranscripcion({
        TRANSCRIPCION: "on",
        TRANSCRIPCION_API_KEY: "k",
        TRANSCRIPCION_IDIOMA: "",
      });
      const fd = cuerpoDeTranscripcion(new Uint8Array([1]), "audio/ogg", sinIdioma);
      expect(fd.get("language")).toBeNull();
    });

    it("la llave NUNCA viaja en el cuerpo: va en la cabecera", () => {
      const fd = cuerpoDeTranscripcion(new Uint8Array([1]), "audio/ogg", cfg);
      for (const [, v] of fd.entries()) {
        if (typeof v === "string") expect(v).not.toContain("k-123");
      }
    });
  });
});
