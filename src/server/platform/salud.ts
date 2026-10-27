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
 *
 * **Qué comprueba y qué no.** `/api/health` responde por la aplicación, no por
 * la organización: un 200 dice «la dirección llega hasta acá», no «ese cliente
 * existe y está sano». Alcanza para lo que esto busca —el dominio olvidado en
 * Coolify, que muere en la puerta y no deja rastro—, y no hay que leerlo como
 * más que eso.
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

/**
 * El protocolo y el puerto salen de `APP_BASE_URL`, igual que en los enlaces
 * de acceso (106). Armar siempre `https://…` sin puerto da la URL correcta en
 * producción y una que no existe en desarrollo — y un panel que miente en
 * rojo en la máquina de quien lo está construyendo es un panel al que se deja
 * de mirar.
 */
export function direccionDe(
  slug: string,
  dominio: string,
  appBaseUrl: string
): string {
  let protocolo = "https";
  let puerto = "";
  try {
    const base = new URL(appBaseUrl);
    protocolo = base.protocol.replace(":", "");
    puerto = base.port ? `:${base.port}` : "";
  } catch {
    // Sin APP_BASE_URL utilizable: https y sin puerto, lo de producción.
  }
  return `${protocolo}://${slug}.${dominio}${puerto}/api/health`;
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
  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const utiles = slugs.filter((s): s is string => !!s?.trim());

  const resultados = await Promise.all(
    utiles.map(async (slug): Promise<SaludDeCliente> => {
      try {
        const r = await fetch(direccionDe(slug, dominio, appBaseUrl), {
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
