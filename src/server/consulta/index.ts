import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * 151 — Lo que el agente le puede preguntar al sistema DEL NEGOCIO.
 *
 * Hasta acá ninguna de las acciones del agente llamaba a un servicio externo.
 * Lo pidió The Student Store: los padres preguntan todos los días cuánto saldo
 * le queda a su hijo, y ese número vive en la base del cliente, detrás de un
 * webhook de n8n.
 *
 * **La regla que hereda del diseño que ya funcionaba allá, y es la que
 * importa:** el modelo solo CAPTURA el dato (la cédula). El valor sale del
 * servicio, nunca del modelo, para que no pueda inventarlo. Es la misma regla
 * que la agenda: el modelo pide, el motor pega.
 *
 * Es una capacidad general y no un «conector de saldo»: un conector serviría a
 * un cliente; esto deja que cualquier negocio le enseñe al agente a
 * preguntarle algo a su propio sistema.
 */

/** Cuánto se espera al sistema del negocio. Una conversación no puede colgarse. */
export const TIMEOUT_MS = 8_000;

/** Techo de lo que se lee de la respuesta: un servicio que devuelve un libro no lo mete en el prompt. */
export const MAX_RESPUESTA = 600;

export type ConsultaConfig = {
  id: string;
  name: string;
  criterio: string | null;
  datoPedido: string;
  url: string;
  method: "GET" | "POST";
  requestField: string;
  responseField: string;
  authHeader: string | null;
  /** Solo si está guardada. El valor NUNCA sale de acá completo. */
  tieneCredencial: boolean;
  ultimos4: string | null;
  active: boolean;
};

type Fila = typeof schema.consultaExterna.$inferSelect;

function aConfig(f: Fila): ConsultaConfig {
  const valor = descifrar(f.authValueEnc);
  return {
    id: f.id,
    name: f.name,
    criterio: f.criterio,
    datoPedido: f.datoPedido,
    url: f.url,
    method: f.method,
    requestField: f.requestField,
    responseField: f.responseField,
    authHeader: f.authHeader,
    tieneCredencial: Boolean(valor),
    ultimos4: valor ? valor.slice(-4) : null,
    active: f.active,
  };
}

/** Nunca lanza: una credencial que no se puede descifrar no tumba la pantalla. */
function descifrar(guardado: string | null): string | null {
  if (!guardado) return null;
  try {
    return decryptSecret(JSON.parse(guardado));
  } catch {
    return null;
  }
}

export async function consultaDeLaOrganizacion(
  organizationId: string
): Promise<ConsultaConfig | null> {
  const db = getDb();
  const filas = await db
    .select()
    .from(schema.consultaExterna)
    .where(scoped(schema.consultaExterna.organizationId, organizationId))
    .limit(1);
  const f = filas[0];
  return f ? aConfig(f) : null;
}

/** La que el agente puede usar: configurada, activa y con lo mínimo para llamar. */
export async function consultaDisponible(
  organizationId: string
): Promise<ConsultaConfig | null> {
  const c = await consultaDeLaOrganizacion(organizationId);
  if (!c || !c.active || !c.url.trim()) return null;
  return c;
}

export type EntradaDeConsulta = {
  name?: string;
  criterio?: string | null;
  datoPedido?: string;
  url?: string;
  method?: "GET" | "POST";
  requestField?: string;
  responseField?: string;
  authHeader?: string | null;
  /** Solo si se está cambiando. `undefined` deja la que ya estaba. */
  authValue?: string | null;
  active?: boolean;
};

export async function guardarConsulta(
  organizationId: string,
  entrada: EntradaDeConsulta
): Promise<ConsultaConfig> {
  const db = getDb();
  const actual = await consultaDeLaOrganizacion(organizationId);

  const campos: Record<string, unknown> = {};
  if (entrada.name !== undefined) campos.name = entrada.name.trim().slice(0, 120);
  if (entrada.criterio !== undefined) {
    campos.criterio = entrada.criterio?.trim().slice(0, 500) || null;
  }
  if (entrada.datoPedido !== undefined) {
    campos.datoPedido = entrada.datoPedido.trim().slice(0, 200);
  }
  if (entrada.url !== undefined) campos.url = entrada.url.trim();
  if (entrada.method !== undefined) campos.method = entrada.method;
  if (entrada.requestField !== undefined) {
    campos.requestField = entrada.requestField.trim();
  }
  if (entrada.responseField !== undefined) {
    campos.responseField = entrada.responseField.trim();
  }
  if (entrada.authHeader !== undefined) {
    campos.authHeader = entrada.authHeader?.trim() || null;
  }
  if (entrada.active !== undefined) campos.active = entrada.active;
  // `null` borra la credencial; `undefined` la deja como está. Un formulario
  // que no toca ese campo no puede dejar al negocio sin su llave.
  if (entrada.authValue !== undefined) {
    campos.authValueEnc = entrada.authValue
      ? JSON.stringify(encryptSecret(entrada.authValue))
      : null;
  }

  if (!actual) {
    const id = newId("consultaExterna");
    await db.insert(schema.consultaExterna).values({
      id,
      organizationId,
      name: (campos.name as string) ?? "Consulta",
      datoPedido: (campos.datoPedido as string) ?? "",
      url: (campos.url as string) ?? "",
      requestField: (campos.requestField as string) ?? "",
      responseField: (campos.responseField as string) ?? "",
      ...campos,
    });
  } else {
    await db
      .update(schema.consultaExterna)
      .set({ ...campos, updatedAt: new Date() })
      .where(eq(schema.consultaExterna.id, actual.id));
  }
  return (await consultaDeLaOrganizacion(organizationId))!;
}

export type ResultadoDeConsulta =
  | { ok: true; valor: string; crudo: string }
  | {
      ok: false;
      motivo: "sin_configurar" | "sin_respuesta" | "proveedor" | "timeout";
      detalle: string;
      /** Lo que contestó, si contestó: es lo que cierra el «curl primero». */
      crudo?: string;
    };

/**
 * PURA — saca el valor de la respuesta.
 *
 * Tolerante por necesidad: un webhook de n8n puede devolver el objeto, un
 * arreglo con un objeto adentro, o el valor pelado. Lo que NO hace es
 * adivinar entre varios campos: si el que se configuró no está, se dice que
 * no vino, y nadie inventa un número.
 */
export function valorDeLaRespuesta(
  cuerpo: unknown,
  campo: string
): string | null {
  const mirar = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.length > 0 ? mirar(v[0]) : null;
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if (campo in obj) {
        const x = obj[campo];
        if (typeof x === "string" || typeof x === "number") return String(x);
        return mirar(x);
      }
      /**
       * Una sola llave que ENVUELVE (`{data: {...}}`): se abre.
       *
       * Solo si adentro hay otro objeto o un arreglo. Con un valor suelto
       * —`{saldo: "Gs. 99.000"}` cuando se configuró `answer`— abrirlo sería
       * devolver un campo que nadie pidió, y es exactamente cómo se contesta
       * un número equivocado con cara de correcto. Lo encontró su prueba.
       */
      const llaves = Object.keys(obj);
      const unico = llaves.length === 1 ? obj[llaves[0]!] : undefined;
      if (unico !== undefined && typeof unico === "object" && unico !== null) {
        return mirar(unico);
      }
    }
    return null;
  };
  const v = mirar(cuerpo);
  return v?.trim() ? v.trim().slice(0, MAX_RESPUESTA) : null;
}

/**
 * Le pregunta al sistema del negocio. **Jamás lanza**: el que llama decide qué
 * decirle al cliente, y lo que nunca puede pasar es que un tercero caído se
 * convierta en un número inventado.
 */
export async function preguntarAlSistema(
  organizationId: string,
  dato: string,
  opts: { config?: ConsultaConfig } = {}
): Promise<ResultadoDeConsulta> {
  const c = opts.config ?? (await consultaDisponible(organizationId));
  if (!c) {
    return { ok: false, motivo: "sin_configurar", detalle: "No hay consulta configurada" };
  }

  const db = getDb();
  const filas = await db
    .select({ enc: schema.consultaExterna.authValueEnc })
    .from(schema.consultaExterna)
    .where(eq(schema.consultaExterna.id, c.id))
    .limit(1);
  const credencial = descifrar(filas[0]?.enc ?? null);

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (c.authHeader && credencial) headers[c.authHeader] = credencial;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const url =
      c.method === "GET"
        ? `${c.url}${c.url.includes("?") ? "&" : "?"}${encodeURIComponent(
            c.requestField
          )}=${encodeURIComponent(dato)}`
        : c.url;

    const res = await fetch(url, {
      method: c.method,
      headers,
      body:
        c.method === "POST"
          ? JSON.stringify({ [c.requestField]: dato })
          : undefined,
      signal: control.signal,
    });

    const crudo = (await res.text()).slice(0, 2000);
    if (!res.ok) {
      return {
        ok: false,
        motivo: "proveedor",
        detalle: `El servicio respondió ${res.status}`,
        crudo,
      };
    }

    let cuerpo: unknown = crudo;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      /* no es JSON: se mira como texto */
    }
    const valor = valorDeLaRespuesta(cuerpo, c.responseField);
    if (!valor) {
      return {
        ok: false,
        motivo: "sin_respuesta",
        detalle: `La respuesta no trae «${c.responseField}»`,
        crudo,
      };
    }
    return { ok: true, valor, crudo };
  } catch (err) {
    const abortado = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      motivo: abortado ? "timeout" : "proveedor",
      detalle: abortado
        ? "El servicio no contestó a tiempo"
        : err instanceof Error
          ? err.message
          : String(err),
    };
  } finally {
    clearTimeout(reloj);
  }
}
