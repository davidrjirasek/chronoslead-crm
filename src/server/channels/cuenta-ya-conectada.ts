/**
 * 144 — «Esa cuenta ya está conectada en otra instancia», dicho con todas las
 * letras.
 *
 * El 17-nov-2026 el dueño intentó conectar Messenger en Castell Muebles y la
 * pantalla le respondió «error interno». Probó con su llave de siempre, no
 * funcionó; generó una llave nueva, tampoco. Estuvo un rato buscando el
 * problema donde no estaba.
 *
 * Lo que de verdad pasaba estaba en el log del servidor:
 *
 *     duplicate key value violates unique constraint
 *     "messenger_credentials_page_uq"
 *     Key (page_id)=(398573520198185) already exists.
 *
 * Su Zernio tenía una sola cuenta de Facebook —la de la agencia— así que la
 * llave resolvió a ESA, y esa página ya vivía en otra organización. El índice
 * único hizo exactamente su trabajo: **impedir que la cuenta de un cliente
 * termine enchufada en la instancia de otro.** Lo que falló no fue el
 * guardián, fue cómo se contó.
 *
 * El producto tenía toda la información para explicarlo —el código `23505` y
 * el nombre de la restricción— y la dejaba escapar sin traducir.
 *
 * Afecta a los cuatro canales por igual: cada tabla de credenciales tiene su
 * índice único por identificador de plataforma, y con una llave de Zernio que
 * ve todas las cuentas del espacio de trabajo, elegir la equivocada es fácil.
 */

/** ¿Es una violación de índice único de Postgres? */
export function esViolacionDeUnico(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  if (code === "23505") return true;
  // Drizzle envuelve el error del driver: el código real viaja en `cause`.
  const cause = (err as { cause?: unknown }).cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: unknown }).code === "23505"
  );
}

/** El nombre de la restricción, esté en el error o en su `cause`. */
function nombreDeLaRestriccion(err: unknown): string {
  if (typeof err !== "object" || err === null) return "";
  const directo = (err as { constraint_name?: unknown }).constraint_name;
  if (typeof directo === "string") return directo;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const c = (cause as { constraint_name?: unknown }).constraint_name;
    if (typeof c === "string") return c;
  }
  return "";
}

/**
 * Cómo se llama, para una persona, lo que ya está tomado.
 *
 * La clave es por restricción y no por canal: dentro de WhatsApp no es lo
 * mismo chocar con otro número (`phone_uq`) que con otra cuenta de Zernio
 * (`account_ref_uq`), y decir cuál de las dos es la diferencia entre entender
 * y adivinar.
 */
const QUE_ESTA_TOMADO: Record<string, string> = {
  messenger_credentials_page_uq: "Esa página de Facebook",
  instagram_credentials_ig_user_uq: "Esa cuenta de Instagram",
  meta_credentials_phone_uq: "Ese número de WhatsApp",
  meta_credentials_account_ref_uq: "Esa cuenta de WhatsApp de Zernio",
  tiktok_credentials_account_ref_uq: "Esa cuenta de TikTok",
};

/**
 * El mensaje que ve el dueño, o null si el error es otro.
 *
 * Devuelve null —en vez de un mensaje genérico— a propósito: un error que no
 * es este tiene que seguir subiendo tal cual. Tapar todo con una frase
 * amable esconde fallos de verdad.
 */
export function mensajeDeCuentaYaConectada(err: unknown): string | null {
  if (!esViolacionDeUnico(err)) return null;

  const restriccion = nombreDeLaRestriccion(err);
  // Chocar con `*_org_uq` es reconectar la MISMA organización: eso no es un
  // conflicto entre clientes y el guardado lo resuelve solo. Si llegara aquí,
  // no es este mensaje.
  if (restriccion.endsWith("_org_uq")) return null;

  const que = QUE_ESTA_TOMADO[restriccion];
  if (!que) return null;

  return (
    `${que} ya está conectada en otra instancia de ChronosLead. ` +
    "Una misma cuenta no puede atender a dos clientes a la vez. " +
    "Si tu llave de Zernio ve varias cuentas, puede haber elegido la " +
    "equivocada: probá pegando a mano el identificador de la que " +
    "corresponde a este cliente."
  );
}
