/**
 * 127 — El cuestionario de puesta en marcha, como DATOS.
 *
 * La pantalla se dibuja desde aquí. Cambiar una pregunta, reordenarla o
 * agregarle una opción es editar este archivo y nada más — que es exactamente
 * lo que va a pasar cuando el cuestionario se generalice para todos los
 * clientes, y lo que no queremos que obligue a tocar la interfaz.
 *
 * El contenido viene de `~/Documents/ChronosLead/onboarding-student-store.md`,
 * que es la versión que el dueño revisó. Hoy está escrito para The Student
 * Store; generalizarlo es otra spec.
 */

export type Campo =
  | {
      id: string;
      tipo: "texto" | "parrafo";
      etiqueta: string;
      ayuda?: string;
      marcador?: string;
      requerido?: boolean;
    }
  | {
      id: string;
      tipo: "una" | "varias";
      etiqueta: string;
      ayuda?: string;
      opciones: readonly string[];
      /** Agrega «Otro» con su campo de texto. */
      otro?: boolean;
      requerido?: boolean;
    }
  | {
      id: string;
      tipo: "tabla";
      etiqueta: string;
      ayuda?: string;
      columnas: readonly string[];
      filas: readonly string[];
    };

/** Texto que explica, sin pedir nada. Es la mitad del valor del cuestionario. */
export type Nota = { tipo: "nota"; texto: string };

export type Bloque = Campo | Nota;

export type Seccion = {
  numero: number;
  titulo: string;
  entrada?: string;
  /**
   * Minutos estimados. Se reparten POR PESO, no en partes iguales: la sección
   * 5 es la más larga y la más valiosa. De aquí sale el «te faltan N minutos»
   * que el dueño pidió para que nadie quede en la incertidumbre.
   */
  minutos: number;
  /** Cuando la sección es para otra persona del equipo del cliente. */
  paraQuien?: string;
  bloques: readonly Bloque[];
};

export const SECCIONES: readonly Seccion[] = [
  {
    numero: 1,
    titulo: "El colegio, y quién más escribe a ese número",
    entrada:
      "Entendemos que hoy cada colegio tiene su propio número, y que este se publica en uno solo. Eso simplifica mucho: el asistente ya sabe de qué colegio es quien escribe, y no tiene que preguntarlo.",
    minutos: 2,
    bloques: [
      { id: "1.1", tipo: "texto", etiqueta: "¿En qué colegio se publica este número?", requerido: true },
      {
        id: "1.2",
        tipo: "una",
        etiqueta: "Cuando se sumen otros colegios, ¿van a tener cada uno su número?",
        opciones: ["Sí, uno por colegio", "No lo tenemos definido"],
      },
      {
        tipo: "nota",
        texto:
          "A ese mismo número también pueden escribir directivos de otros colegios preguntando por el servicio. No es un padre: es un cliente potencial, y de los grandes. Nuestra sugerencia es separarlos en dos números — este queda dedicado a las familias del colegio, y un número general de The Student Store atiende a los colegios interesados, con su propio asistente y sus propias campañas.",
      },
      {
        id: "1.3",
        tipo: "una",
        etiqueta: "¿Les parece?",
        opciones: [
          "Sí, preferimos un número aparte para ventas",
          "No, que este mismo atienda las dos cosas",
          "Los colegios nos contactan por otro canal",
        ],
      },
      {
        id: "1.4",
        tipo: "una",
        etiqueta: "¿Qué querés que haga el asistente cuando escribe un directivo?",
        ayuda:
          "Nuestra propuesta es que haga las dos cosas a la vez: le pasa el contacto comercial y le avisa a su equipo en el momento, para que no dependa de que esa persona dé un segundo paso.",
        opciones: [
          "Sí, las dos cosas",
          "Solo pasarle el contacto",
          "Solo avisar al equipo, sin darle otro número",
        ],
      },
      { id: "1.5", tipo: "texto", etiqueta: "¿A qué número tiene que llegar ese aviso?" },
      {
        id: "1.6",
        tipo: "parrafo",
        etiqueta: "¿Qué datos le sirven al equipo en ese aviso?",
        marcador: "nombre, colegio, cargo, qué preguntó…",
      },
    ],
  },
  {
    numero: 2,
    titulo: "Horarios",
    minutos: 2,
    bloques: [
      {
        id: "2.1",
        tipo: "parrafo",
        etiqueta: "¿En qué horario se atiende el comedor en cada colegio?",
        requerido: true,
      },
      {
        id: "2.2",
        tipo: "tabla",
        etiqueta: "¿En qué horario hay personas disponibles para responder un WhatsApp?",
        ayuda:
          "El asistente contesta siempre. Esto es para saber cuándo puede prometer que alguien va a mirar un caso.",
        columnas: ["Desde", "Hasta"],
        filas: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
      },
      {
        id: "2.3",
        tipo: "parrafo",
        etiqueta: "¿Qué pasa en vacaciones y feriados? ¿El asistente debería decir algo distinto?",
      },
    ],
  },
  {
    numero: 3,
    titulo: "El menú y los precios",
    minutos: 2,
    bloques: [
      {
        id: "3.1",
        tipo: "parrafo",
        etiqueta: "¿Cómo está organizado lo que venden?",
        marcador: "almuerzo del día, kiosco, bebidas, combos…",
        requerido: true,
      },
      {
        id: "3.2",
        tipo: "una",
        etiqueta: "¿Los precios son iguales en todos los colegios, o cambian?",
        opciones: ["Iguales en todos", "Cambian según el colegio"],
      },
      {
        id: "3.3",
        tipo: "parrafo",
        etiqueta: "La lista de precios",
        ayuda:
          "Pónganla como la tengan, o díganos de dónde la sacamos. No hace falta transcribirla: si es un archivo o una captura, nos la mandan aparte y lo anotan acá.",
      },
      { id: "3.4", tipo: "texto", etiqueta: "¿Cada cuánto cambian los precios?" },
      {
        tipo: "nota",
        texto:
          "Si cambian seguido, conviene que el asistente los consulte en su sistema en vez de recordarlos. Eso es parte de la sección 8.",
      },
      {
        id: "3.5",
        tipo: "parrafo",
        etiqueta: "El almuerzo con recargo",
        ayuda:
          "Nos contaron que hay un precio normal y uno con recargo si se pide tarde. ¿Hasta qué hora rige el normal? ¿Cuánto es el recargo? ¿Hay una hora después de la cual ya no se puede pedir? ¿Es igual en todos los colegios?",
      },
      {
        id: "3.6",
        tipo: "texto",
        etiqueta: "¿El menú semanal se publica en algún lado donde el asistente pueda mandarlo?",
        marcador: "un enlace, el QR, la web de padres",
      },
    ],
  },
  {
    numero: 4,
    titulo: "Saldo y pagos",
    minutos: 2,
    bloques: [
      {
        id: "4.1",
        tipo: "parrafo",
        etiqueta: "Expliquen paso a paso cómo carga saldo un padre",
        ayuda: "Como se lo dirían a una mamá que pregunta por primera vez.",
        requerido: true,
      },
      { id: "4.2", tipo: "texto", etiqueta: "¿Cuánto tarda en acreditarse una transferencia?" },
      {
        id: "4.3",
        tipo: "parrafo",
        etiqueta:
          "Cuando un padre manda el comprobante por WhatsApp, ¿qué hacen hoy con ese comprobante? ¿Quién lo procesa y en cuánto tiempo?",
      },
      {
        id: "4.4",
        tipo: "parrafo",
        etiqueta:
          "¿Qué pasa si un alumno se queda sin saldo? ¿Come igual, se le avisa a los padres, hay un límite de fiado?",
      },
      {
        id: "4.5",
        tipo: "parrafo",
        etiqueta: "¿Se pueden poner límites de consumo por día? ¿El padre lo hace solo desde la web?",
      },
    ],
  },
  {
    numero: 5,
    titulo: "Lo que más les preguntan",
    entrada:
      "Esta es la sección más importante del cuestionario. De acá sale casi toda la calidad del asistente: es lo único que no se puede sacar de ningún manual.",
    minutos: 5,
    bloques: [
      {
        id: "5.1",
        tipo: "tabla",
        etiqueta: "Las diez consultas más frecuentes de los padres, y la respuesta que dan hoy",
        ayuda: "Escríbanlas como las escriben de verdad, sin arreglarlas.",
        columnas: ["Lo que pregunta el padre", "Cómo lo contestan hoy"],
        filas: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
      {
        id: "5.2",
        tipo: "parrafo",
        etiqueta:
          "¿Cuáles son las que más tiempo les consumen, o las que siempre terminan derivando a alguien?",
      },
      { id: "5.3", tipo: "parrafo", etiqueta: "¿Hay quejas o reclamos frecuentes? ¿Cómo los manejan?" },
      {
        id: "5.4",
        tipo: "parrafo",
        etiqueta:
          "¿Les escriben también los colegios, o solo los padres? Si escriben los dos, ¿se distinguen de alguna forma?",
      },
    ],
  },
  {
    numero: 6,
    titulo: "Cómo tiene que hablar",
    minutos: 1,
    bloques: [
      { id: "6.1", tipo: "texto", etiqueta: "¿Cómo se va a llamar el asistente?", requerido: true },
      { id: "6.2", tipo: "una", etiqueta: "¿Cómo tratan a los padres?", opciones: ["De usted", "De vos", "De tú"] },
      {
        id: "6.3",
        tipo: "una",
        etiqueta: "¿Qué tono?",
        ayuda:
          "Están hablando con padres sobre la alimentación de sus hijos. Un tono seco se lee mal aunque la información sea correcta.",
        opciones: ["Cercano y cálido", "Profesional y directo", "Formal"],
      },
      {
        id: "6.4",
        tipo: "parrafo",
        etiqueta: "¿Cómo quieren que salude a alguien que escribe por primera vez?",
        ayuda: "Escríbanlo tal cual.",
      },
      { id: "6.5", tipo: "parrafo", etiqueta: "¿Hay algo que el asistente nunca deba decir o prometer?" },
    ],
  },
  {
    numero: 7,
    titulo: "Qué tiene que lograr, y qué pasa a una persona",
    minutos: 3,
    bloques: [
      {
        id: "7.1",
        tipo: "varias",
        etiqueta: "¿Para qué quieren el asistente?",
        ayuda: "Marquen todo lo que aplique.",
        opciones: [
          "Contestar consultas de saldo",
          "Confirmar si se acreditó una transferencia",
          "Tomar reservas de almuerzo",
          "Informar el menú del día o de la semana",
          "Responder precios y horarios",
          "Recibir quejas y derivarlas",
        ],
        otro: true,
      },
      { id: "7.2", tipo: "parrafo", etiqueta: "¿Qué temas tienen que pasar sí o sí a una persona?" },
      {
        tipo: "nota",
        texto:
          "Sobre cómo reconoce a quien escribe: la idea es verificar UNA sola vez y después recordar. Pedirle la cédula en cada consulta a una mamá que pregunta todos los días sería insoportable. La primera vez, el adulto da su propia cédula y la cruzamos contra los teléfonos registrados de esa cuenta.",
      },
      {
        id: "7.3.1",
        tipo: "una",
        etiqueta:
          "¿Su sistema tiene hoy los teléfonos y las cédulas de los adultos autorizados de cada alumno?",
        opciones: ["Sí, los dos", "Solo los teléfonos", "Solo las cédulas", "Ninguno, habría que cargarlos"],
      },
      {
        id: "7.3.2",
        tipo: "parrafo",
        etiqueta: "¿Cuántos adultos puede tener autorizados un alumno? ¿Quién los da de alta?",
      },
      {
        id: "7.3.3",
        tipo: "una",
        etiqueta: "Cuando un padre cambia de número, ¿quién lo resuelve?",
        ayuda:
          "Este es el punto delicado de todo el flujo. Si para autorizar un teléfono nuevo alcanzara con el nombre, la cédula y el número anterior, cualquiera que los tenga podría pedir que el acceso a esa cuenta se mueva a su teléfono — y en una comunidad escolar esos tres datos circulan solos. Recomendamos que lo haga una persona: un padre cambia de número una vez cada varios años, así que el trabajo extra es mínimo.",
        opciones: [
          "Lo resuelve una persona del equipo, no el asistente",
          "El asistente lo hace solo, pidiendo algún dato de la cuenta",
        ],
      },
      {
        id: "7.4",
        tipo: "parrafo",
        etiqueta:
          "¿Un mismo padre puede tener varios hijos en el sistema? ¿Y un alumno, varios adultos autorizados?",
      },
    ],
  },
  {
    numero: 8,
    titulo: "Para quien maneja su sistema",
    entrada:
      "Esta sección es técnica. El asistente puede responder consultas en vivo contra su plataforma — saldo, acreditaciones, reservas — pero necesita una puerta por donde preguntar. No hace falta que esté lista para arrancar: puede empezar con menú, precios y horarios, que no necesitan conexión.",
    paraQuien: "Pueden pasarle esta sección a su equipo técnico y seguir con la 9.",
    minutos: 1,
    bloques: [
      { id: "8.1", tipo: "parrafo", etiqueta: "¿Su sistema ya expone una API o servicio web? ¿Con qué autenticación?" },
      {
        id: "8.2",
        tipo: "varias",
        etiqueta: "¿Cuáles de estas consultas pueden exponer?",
        opciones: [
          "Saldo de un alumno",
          "Últimos movimientos",
          "Estado de una acreditación",
          "Reservar almuerzo",
          "Menú del día",
          "Precios por colegio",
        ],
      },
      {
        id: "8.3",
        tipo: "texto",
        etiqueta: "¿Qué identificador conviene usar para un alumno?",
        marcador: "la cédula, un código interno, el número de la tarjeta",
      },
      { id: "8.4", tipo: "texto", etiqueta: "¿Hay límite de consultas por minuto que debamos respetar?" },
      { id: "8.5", tipo: "texto", etiqueta: "¿Quién es el contacto técnico? Nombre, correo y teléfono." },
    ],
  },
  {
    numero: 9,
    titulo: "WhatsApp",
    minutos: 1,
    bloques: [
      {
        id: "9.1",
        tipo: "una",
        etiqueta: "¿Qué número quieren usar?",
        ayuda:
          "Si es el que ya usan, avísennos cuanto antes: conectarlo conservando el WhatsApp del teléfono requiere un trámite con Meta que lleva varios días. No es complicado, pero no es inmediato.",
        opciones: ["El que ya usamos, el que los padres tienen agendado", "Uno nuevo"],
        requerido: true,
      },
      { id: "9.2", tipo: "texto", etiqueta: "El número, con código de país", requerido: true },
      {
        id: "9.3",
        tipo: "una",
        etiqueta: "¿Quieren que el asistente atienda también Instagram y Facebook?",
        ayuda: "Atiende mensajes directos. Los comentarios en publicaciones, por ahora no.",
        opciones: ["Sí", "Por ahora no"],
      },
    ],
  },
  {
    numero: 10,
    titulo: "Accesos y materiales",
    minutos: 1,
    bloques: [
      {
        id: "10.1",
        tipo: "texto",
        etiqueta: "¿Quién va a ser el dueño de la cuenta? Nombre y correo.",
        ayuda:
          "Es una sola persona y es la única que no se puede quitar. A ese correo le llega un enlace para elegir su contraseña: nadie más la va a conocer, nosotros tampoco.",
        requerido: true,
      },
      {
        id: "10.2",
        tipo: "parrafo",
        etiqueta: "¿Quiénes más necesitan entrar? Nombre, correo y qué tiene que poder hacer cada uno.",
        ayuda:
          "Hay dos niveles. «Configurar»: cambia precios, menú, horarios y cómo habla el asistente, y además atiende. «Solo atender»: ve y contesta conversaciones, no cambia la configuración. Para quien está en el mostrador conviene el segundo — menos permisos no es desconfianza, es que nadie cambie un precio sin querer.",
      },
      {
        tipo: "nota",
        texto:
          "Junto con la cuenta del dueño creamos una cuenta de soporte de Creativo 4D Group con permiso de configuración, para cargar todo esto por ustedes al principio y para arreglar algo sin pedirles su contraseña. Ve lo mismo que el dueño, dentro de su organización y en ninguna otra; no puede quitar al dueño; y la pueden quitar cuando quieran desde Ajustes → Equipo. Se lo decimos antes y no después a propósito.",
      },
      {
        id: "10.3",
        tipo: "una",
        etiqueta: "¿Les parece bien esa cuenta de soporte?",
        opciones: [
          "Sí, créenla con la cuenta del dueño",
          "Preferimos que no exista hasta que haya algo que arreglar",
        ],
      },
      {
        id: "10.4",
        tipo: "parrafo",
        etiqueta: "Materiales",
        ayuda:
          "Manden lo que tengan, aunque esté desordenado: logo en buena calidad, lista de precios y menú de ejemplo, capturas de conversaciones reales con padres (tapando los datos personales), y lo que usen para capacitar a alguien nuevo en atención. Las capturas son lo más valioso de la lista: muestran cómo habla su gente y cómo preguntan los padres. Anoten acá qué nos van a mandar.",
      },
    ],
  },
] as const;

export const TOTAL_SECCIONES = SECCIONES.length;

/** El total que se le promete al cliente en la primera pantalla. */
export const MINUTOS_TOTALES = SECCIONES.reduce((t, s) => t + s.minutos, 0);

/**
 * Minutos que faltan al ESTAR en `indice` (0-based), contando la sección
 * actual como pendiente: alguien que está en la primera tiene que ver el total,
 * no el total menos la primera.
 */
export function minutosRestantes(indice: number): number {
  return SECCIONES.slice(Math.max(0, indice)).reduce((t, s) => t + s.minutos, 0);
}

/** Los campos de una sección, sin las notas. Para validar y para guardar. */
export function camposDe(seccion: Seccion): readonly Campo[] {
  return seccion.bloques.filter((b): b is Campo => b.tipo !== "nota");
}
