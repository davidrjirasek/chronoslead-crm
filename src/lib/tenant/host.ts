/**
 * Resolución del tenant a partir del Host (spec 101, paso 1 de la skill
 * `saas-multitenant`).
 *
 * Pura a propósito: sin base de datos, sin sesión y sin `headers()`. Todo el
 * aislamiento cuelga de esta función, así que tiene que poder probarse de
 * forma exhaustiva sin levantar nada.
 */

/**
 * Etiquetas que la plataforma se reserva. Si un cliente registrara `api` o
 * `alta` se quedaría con una puerta de la plataforma, y quitársela después es
 * romperle su CRM.
 *
 * `demo` NO está aquí: es el nombre natural de una organización de prueba.
 */
export const SLUGS_RESERVADOS = new Set([
  "www",
  "admin",
  "alta",
  "api",
  "app",
  "mail",
  "smtp",
  "imap",
  "static",
  "assets",
  "cdn",
  "status",
  "soporte",
  "ayuda",
  "blog",
  "docs",
  "panel",
  /**
   * 125 — El panel de despliegue vive en `coolify.chronoslead.com` (HTTPS por
   * Cloudflare, en vez del puerto 8000 expuesto). Sin reservarlo, un cliente
   * podría darse de alta con ese identificador: el proxy le daría prioridad al
   * panel y ese cliente NUNCA podría entrar a su CRM, sin un error que lo
   * explique. Lo detectó una pregunta del dueño sobre por qué va en un
   * subdominio.
   */
  "coolify",
  /**
   * 127 — El formulario de onboarding vive en `onboarding.chronoslead.com`.
   * Mismo riesgo que `coolify`: un cliente con ese identificador quedaría
   * detrás del formulario y nunca podría entrar a su CRM. Lo señaló el dueño
   * al elegir el subdominio, descartando `alta` —que ya es una puerta de la
   * plataforma— justamente por no querer quemar nombres que harán falta.
   */
  "onboarding",
]);

/**
 * 3-30 caracteres, minúsculas, dígitos y guiones; sin guion al inicio ni al final.
 *
 * La skill trae `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$`, que contradice su propio
 * comentario: acepta slugs de UN carácter y rechaza los de dos. Aquí se exige el
 * rango que la skill promete — con 3 mínimo, `a.chronoslead.com` no es de nadie.
 */
const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export type TenantHost =
  | { kind: "tenant"; slug: string }
  | { kind: "landing" }
  | { kind: "admin" }
  | { kind: "alta" }
  | { kind: "desconocido" };

/**
 * Minúsculas, sin puerto y sin el punto final del FQDN.
 *
 * El punto final importa: `demo.chronoslead.com.` es un nombre válido en DNS y
 * sin normalizarlo un cliente real vería «esta instancia no existe».
 */
export function normalizarHost(host?: string | null): string {
  if (!host) return "";
  let h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    const cierre = h.indexOf("]");
    h = cierre === -1 ? h : h.slice(0, cierre + 1);
  } else {
    const i = h.lastIndexOf(":");
    if (i !== -1) h = h.slice(0, i);
  }
  return h.endsWith(".") ? h.slice(0, -1) : h;
}

/**
 * `baseDomain` entra como parámetro para que las pruebas cubran producción
 * (`chronoslead.com`) y local (`lvh.me`) sin tocar variables de entorno.
 */
export function resolveTenantFromHost(
  host: string | null | undefined,
  baseDomain: string
): TenantHost {
  const h = normalizarHost(host);
  const base = normalizarHost(baseDomain);
  if (!h || !base) return { kind: "desconocido" };
  if (h === base) return { kind: "landing" };
  if (!h.endsWith(`.${base}`)) return { kind: "desconocido" };

  const etiqueta = h.slice(0, h.length - base.length - 1);
  // Aceptar `a.b.dominio` dejaría que un host inventado cayera en un tenant real.
  if (etiqueta.includes(".")) return { kind: "desconocido" };
  if (etiqueta === "www") return { kind: "landing" };
  if (etiqueta === "admin") return { kind: "admin" };
  if (etiqueta === "alta") return { kind: "alta" };
  if (!SLUG_VALIDO.test(etiqueta) || SLUGS_RESERVADOS.has(etiqueta)) {
    return { kind: "desconocido" };
  }
  return { kind: "tenant", slug: etiqueta };
}
