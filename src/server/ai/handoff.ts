/**
 * Patrón de RESPALDO de intención de escalado (FR-022). Se evalúa sobre el
 * mensaje del cliente ANTES del LLM: si matchea, el handoff ocurre aunque el
 * modelo no lo detecte. Diseñado para exigir un verbo de contacto cerca del
 * objeto humano — "somos 4 personas" NO matchea (test unitario).
 */
export const HANDOFF_BACKUP_REGEX =
  /(hablar|comunicar|contactar)[\s\S]{0,40}?(asesor|humano|persona|alguien)|un asesor|atenci[oó]n humana/i;

export function matchesHandoffIntent(text: string): boolean {
  return HANDOFF_BACKUP_REGEX.test(text);
}

/**
 * Lo que oye el cliente cuando el patrón de respaldo lo traspasa.
 *
 * El camino del modelo se despide con su `farewell`; este no mandaba NADA, y
 * justo atrapa las peticiones más directas («quiero hablar con un humano»).
 * El traspaso ocurría por dentro, pero del lado de WhatsApp se leía como que
 * el bot había dejado de contestar a quien pidió una persona.
 *
 * Es fijo porque el perfil del agente no tiene un campo para esto
 * (`escalationRules` dice CUÁNDO escalar, no qué decir) y el turno corta
 * antes del modelo a propósito: no hay de dónde sacar otro texto. No promete
 * un plazo ni un nombre que el CRM no conoce.
 *
 * 118 — Y DICE QUE SIGUE DISPONIBLE. Decir solo «en breve te responden» deja
 * al cliente callado esperando, cuando el agente le sigue contestando: desde
 * 112 el traspaso ya no lo apaga. Regla del dueño: «no hace falta que
 * insista, pero sí puede decirle que está disponible y puede preguntarle lo
 * que necesite igual». Quedarse callado es lo peor que le puede pasar a quien
 * está del otro lado.
 *
 * Sigue sin prometer plazo: esto lo lee el cliente de CUALQUIER organización
 * de la plataforma, y «en horario de oficina» sería una promesa hecha en
 * nombre de negocios que no la dieron.
 */
export const HANDOFF_BACKUP_ACK =
  "Claro, le aviso al equipo para que te atienda una persona. " +
  "Mientras tanto seguí contándome lo que necesites, que te sigo respondiendo.";
