"use server";

import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
// Un archivo "use server" solo puede exportar funciones asíncronas: el tipo
// y la constante viven aparte (ver `estado.ts`).
import { ESTADO_INICIAL, type EstadoGuardado } from "@/server/cuestionario/estado";
import { SECCIONES, TOTAL_SECCIONES, camposDe } from "@/server/cuestionario/secciones";
import { crear, guardarSeccion, leerPorLlave, marcarEnviado } from "@/server/cuestionario/store";

/**
 * 127 — Guardar una sección del cuestionario.
 *
 * Una acción por sección y no una al final: **lo que se guarda es lo que no se
 * pierde.** Si alguien contesta cinco secciones y se le corta internet en la
 * sexta, las cinco están.
 */

const ERROR_GENERICO =
  "No pudimos guardar en este momento. Volvé a intentar en un minuto: lo que escribiste sigue en la pantalla.";

/** Es una superficie pública: sin límite, es un buzón de spam abierto. */
const LIMITE_CREACION = { windowMs: 60 * 60_000, max: 10 };
const LIMITE_GUARDADO = { windowMs: 10 * 60_000, max: 120 };

const entrada = z.object({
  llave: z.string().trim().max(64).optional(),
  seccion: z.coerce.number().int().min(0).max(TOTAL_SECCIONES - 1),
  cliente: z.string().trim().min(2).max(120).optional(),
  contacto: z.string().trim().max(120).optional(),
  correo: z.string().trim().max(160).optional(),
  /** Las respuestas de ESTA sección, serializadas por la pantalla. */
  datos: z.string().max(200_000),
  final: z.string().optional(),
});

export async function guardarSeccionAction(
  _prev: EstadoGuardado,
  formData: FormData
): Promise<EstadoGuardado> {
  const parsed = entrada.safeParse({
    llave: formData.get("llave") || undefined,
    seccion: formData.get("seccion"),
    cliente: formData.get("cliente") || undefined,
    contacto: formData.get("contacto") || undefined,
    correo: formData.get("correo") || undefined,
    datos: formData.get("datos") ?? "{}",
    final: formData.get("final") || undefined,
  });
  if (!parsed.success) return { ...ESTADO_INICIAL, error: ERROR_GENERICO };

  let respuestas: Record<string, unknown>;
  try {
    const crudo: unknown = JSON.parse(parsed.data.datos);
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) throw new Error("forma");
    respuestas = crudo as Record<string, unknown>;
  } catch {
    return { ...ESTADO_INICIAL, error: ERROR_GENERICO };
  }

  const seccion = SECCIONES[parsed.data.seccion];
  if (!seccion) return { ...ESTADO_INICIAL, error: ERROR_GENERICO };

  // Solo se exige lo marcado como obligatorio, y se devuelve QUÉ faltó: un
  // formulario que dice «revisá los datos» sin decir cuál se abandona.
  const faltan = camposDe(seccion)
    // Las tablas no llevan `requerido`: nunca se exige una tabla completa.
    .filter((c) => "requerido" in c && c.requerido && !tieneContenido(respuestas[c.id]))
    .map((c) => c.id);
  if (faltan.length > 0) {
    return {
      ok: false,
      error: null,
      llave: parsed.data.llave ?? null,
      faltan,
    };
  }

  try {
    let llave = parsed.data.llave;

    if (!llave) {
      const cliente = parsed.data.cliente;
      if (!cliente) return { ...ESTADO_INICIAL, error: ERROR_GENERICO, faltan: ["cliente"] };
      if (!checkRateLimit(`cuestionario-crear:${cliente.toLowerCase()}`, LIMITE_CREACION).allowed) {
        return { ...ESTADO_INICIAL, error: ERROR_GENERICO };
      }
      llave = await crear({
        cliente,
        contacto: parsed.data.contacto ?? null,
        correo: parsed.data.correo ?? null,
      });
    } else {
      if (!checkRateLimit(`cuestionario-guardar:${llave}`, LIMITE_GUARDADO).allowed) {
        return { ...ESTADO_INICIAL, error: ERROR_GENERICO, llave };
      }
      // Una llave inventada no debe crear nada ni decir si existe.
      if (!(await leerPorLlave(llave))) {
        return { ...ESTADO_INICIAL, error: ERROR_GENERICO };
      }
    }

    await guardarSeccion(llave, parsed.data.seccion, respuestas);
    if (parsed.data.final === "1") await marcarEnviado(llave);

    return { ok: true, error: null, llave, faltan: [] };
  } catch (err) {
    // Al cliente no se le cuenta qué se rompió del lado nuestro.
    console.error("[cuestionario] no se pudo guardar:", err);
    return { ...ESTADO_INICIAL, error: ERROR_GENERICO, llave: parsed.data.llave ?? null };
  }
}

function tieneContenido(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(tieneContenido);
  if (typeof v === "object") return Object.values(v as object).some(tieneContenido);
  return true;
}
