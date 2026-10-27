/**
 * 123 — ¿La dirección de cada cliente responde?
 *
 * Es la comprobación de más valor del panel, y por un motivo concreto: atrapa
 * **el paso que más se olvida al dar de alta**. El cliente queda perfecto en
 * la base de datos, pero si su subdominio no se agregó en Coolify, su
 * dirección devuelve `503 no available server` y la aplicación ni se entera —
 * el pedido muere en la puerta, así que no hay registro donde mirarlo.
 *
 * Hoy eso se descubre cuando el cliente llama. Con esto, se ve en rojo antes.
 *
 * Las tres respuestas que importan:
 *
 * | Lo que llega | Qué significa |
 * |---|---|
 * | 200 | bien |
 * | 503 | el dominio NO está en la lista de Coolify |
 * | nada | el servidor no contesta, o no hay red desde aquí |
 */
import { baseDomain } from "@/server/tenant/edition";

export type EstadoDeDireccion = "ok" | "sin_dominio" | "sin_respuesta" | "otro";

export type SaludDeCliente = {
  slug: string;
  estado: EstadoDeDireccion;
  /** El código tal cual, para el caso «otro»: adivinar ahí sería peor. */
  codigo: number | null;
};

/** Más de esto y el panel se siente roto; menos y un servidor lento da falsos rojos. */
const ESPERA_MS = 4000;

export function interpretar(codigo: number | null): EstadoDeDireccion {
  if (codigo === null) return "sin_respuesta";
  if (codigo === 200) return "ok";
  if (codigo === 503) return "sin_dominio";
  return "otro";
}

export function direccionDe(slug: string, dominio: string): string {
  return `https://${slug}.${dominio}/api/health`;
}

/**
 * Consulta todas a la vez. En serie, veinte clientes serían veinte esperas
 * encadenadas y el panel tardaría medio minuto; en paralelo tarda lo que la
 * más lenta.
 *
 * Nunca lanza: un panel que no abre porque una comprobación falló es peor que
 * un panel con una fila en gris.
 */
export async function saludDeLasDirecciones(
  slugs: (string | null)[]
): Promise<Map<string, SaludDeCliente>> {
  const dominio = baseDomain();
  const utiles = slugs.filter((s): s is string => !!s?.trim());

  const resultados = await Promise.all(
    utiles.map(async (slug): Promise<SaludDeCliente> => {
      try {
        const r = await fetch(direccionDe(slug, dominio), {
          method: "GET",
          signal: AbortSignal.timeout(ESPERA_MS),
          cache: "no-store",
        });
        return { slug, estado: interpretar(r.status), codigo: r.status };
      } catch {
        return { slug, estado: "sin_respuesta", codigo: null };
      }
    })
  );

  return new Map(resultados.map((r) => [r.slug, r]));
}
