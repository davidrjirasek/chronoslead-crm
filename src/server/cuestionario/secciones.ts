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

/**
 * 130 — La variante de The Student Store. **No se toca**: su enlace ya está en
 * manos del cliente y cambiarle las preguntas mientras lo completa sería
 * mover el piso debajo de alguien que está escribiendo.
 */
const THE_STUDENT_STORE: readonly Seccion[] = [
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

/**
 * 130 — La variante GENERAL: sirve para cualquier cliente.
 *
 * Es la misma estructura de diez secciones, con las preguntas escritas sin
 * suponer el rubro. Donde la de The Student Store pregunta «¿cómo carga saldo
 * un padre?», aquí pregunta «¿cómo te paga un cliente?».
 *
 * Lo verdaderamente propio de cada negocio —cupos por grado, tipos de cultivo,
 * modelos de vehículo— no va acá: va en la reunión de diagnóstico, donde se
 * pregunta mejor, o en un bloque propio de esa variante.
 */
const GENERAL: readonly Seccion[] = [
  {
    numero: 1,
    titulo: "Tu negocio, y quién te escribe",
    entrada:
      "Empecemos por lo básico: a qué se dedica tu negocio y qué clase de gente te escribe. De acá sale todo lo demás.",
    minutos: 2,
    bloques: [
      {
        id: "1.1",
        tipo: "texto",
        etiqueta: "¿A qué se dedica tu negocio?",
        marcador: "en una línea, como se lo dirías a alguien que no te conoce",
        requerido: true,
      },
      {
        id: "1.2",
        tipo: "parrafo",
        etiqueta: "¿Quién te escribe por WhatsApp, y para qué?",
        ayuda: "Si hay más de un tipo de persona —por ejemplo, clientes y proveedores—, contanos cuáles y en qué proporción.",
        requerido: true,
      },
      {
        id: "1.3",
        tipo: "una",
        etiqueta: "¿Tenés sucursales, locales o sedes?",
        opciones: ["Una sola", "Varias, y este número atiende a todas", "Varias, y cada una tiene su número"],
      },
      {
        tipo: "nota",
        texto:
          "A veces al mismo número escribe alguien que no es un cliente común: un negocio que quiere comprar al por mayor, un colega, alguien que ofrece algo. Son conversaciones distintas y conviene que el asesor las reconozca en vez de tratarlas como una consulta más.",
      },
      {
        id: "1.4",
        tipo: "parrafo",
        etiqueta: "¿Te escribe alguien así? ¿Qué querés que haga el asesor cuando pasa?",
        marcador: "pasarle un contacto, avisarle a alguien del equipo, tomarle los datos…",
      },
      { id: "1.5", tipo: "texto", etiqueta: "Si hay que avisarle a alguien, ¿a qué número?" },
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
        etiqueta: "¿En qué horario atiende tu negocio?",
        ayuda: "Si cambia por sucursal o por temporada, contalo.",
        requerido: true,
      },
      {
        id: "2.2",
        tipo: "tabla",
        etiqueta: "¿En qué horario hay personas disponibles para responder un WhatsApp?",
        ayuda:
          "El asesor contesta siempre. Esto es para saber cuándo puede prometer que alguien va a mirar un caso.",
        columnas: ["Desde", "Hasta"],
        filas: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
      },
      {
        id: "2.3",
        tipo: "parrafo",
        etiqueta: "¿Hay feriados, vacaciones o temporadas en que esto cambia?",
      },
    ],
  },
  {
    numero: 3,
    titulo: "Qué vendés, y a qué precio",
    minutos: 2,
    bloques: [
      {
        id: "3.1",
        tipo: "parrafo",
        etiqueta: "¿Qué vendés? Contanos cómo está organizado.",
        marcador: "categorías, servicios, planes, líneas de producto…",
        requerido: true,
      },
      {
        id: "3.2",
        tipo: "una",
        etiqueta: "¿Los precios son públicos?",
        ayuda:
          "No hay respuesta correcta. Hay negocios donde decir el precio al instante acelera la venta, y otros donde conviene entender primero qué necesita la persona.",
        opciones: [
          "Sí, el asesor puede decirlos",
          "Solo algunos",
          "No, primero hay que entender qué necesita",
        ],
      },
      {
        id: "3.3",
        tipo: "parrafo",
        etiqueta: "La lista de precios",
        ayuda:
          "Pónela como la tengas, o decinos de dónde la sacamos. Si es un archivo o una captura, mandanosla aparte y anotalo acá.",
      },
      { id: "3.4", tipo: "texto", etiqueta: "¿Cada cuánto cambian los precios?" },
      {
        id: "3.5",
        tipo: "parrafo",
        etiqueta: "¿Hay promociones, descuentos o condiciones especiales que el asesor deba conocer?",
        marcador: "por cantidad, por temporada, por forma de pago, por cliente frecuente…",
      },
    ],
  },
  {
    numero: 4,
    titulo: "Cómo te pagan",
    minutos: 2,
    bloques: [
      {
        id: "4.1",
        tipo: "parrafo",
        etiqueta: "Explicá paso a paso cómo te paga un cliente",
        ayuda: "Como se lo dirías a alguien que te compra por primera vez.",
        requerido: true,
      },
      {
        id: "4.2",
        tipo: "varias",
        etiqueta: "¿Qué formas de pago aceptás?",
        opciones: ["Efectivo", "Transferencia", "Tarjeta", "Billetera electrónica", "Crédito propio o cuotas"],
        otro: true,
      },
      {
        id: "4.3",
        tipo: "parrafo",
        etiqueta: "Cuando alguien manda un comprobante por WhatsApp, ¿qué pasa después? ¿Quién lo procesa y en cuánto tiempo?",
      },
      {
        id: "4.4",
        tipo: "parrafo",
        etiqueta: "¿Hay algo del cobro que el asesor NO deba resolver y tenga que pasar sí o sí a una persona?",
      },
    ],
  },
  {
    numero: 5,
    titulo: "Lo que más te preguntan",
    entrada:
      "Esta es la sección más importante del cuestionario. De acá sale casi toda la calidad del asesor: es lo único que no se puede sacar de ningún manual.",
    minutos: 5,
    bloques: [
      {
        id: "5.1",
        tipo: "tabla",
        etiqueta: "Las diez consultas más frecuentes, y la respuesta que das hoy",
        ayuda: "Escribilas como las escribís de verdad, sin arreglarlas.",
        columnas: ["Lo que pregunta el cliente", "Cómo lo contestás hoy"],
        filas: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
      {
        id: "5.2",
        tipo: "parrafo",
        etiqueta: "¿Cuáles te consumen más tiempo, o siempre terminan derivando a alguien?",
      },
      { id: "5.3", tipo: "parrafo", etiqueta: "¿Hay quejas o reclamos frecuentes? ¿Cómo los manejás?" },
      {
        id: "5.4",
        tipo: "parrafo",
        etiqueta: "¿Qué te preguntan que todavía no sepas contestar bien?",
        ayuda: "Lo que hoy te hace dudar o consultar con alguien. Es donde el asesor puede ayudar más.",
      },
    ],
  },
  {
    numero: 6,
    titulo: "Cómo tiene que hablar",
    minutos: 1,
    bloques: [
      { id: "6.1", tipo: "texto", etiqueta: "¿Cómo se va a llamar el asesor?", requerido: true },
      { id: "6.2", tipo: "una", etiqueta: "¿Cómo tratás a tus clientes?", opciones: ["De usted", "De vos", "De tú"] },
      {
        id: "6.3",
        tipo: "una",
        etiqueta: "¿Qué tono?",
        opciones: ["Cercano y cálido", "Profesional y directo", "Formal"],
      },
      {
        id: "6.4",
        tipo: "parrafo",
        etiqueta: "¿Cómo querés que salude a alguien que escribe por primera vez?",
        ayuda: "Escribilo tal cual.",
      },
      { id: "6.5", tipo: "parrafo", etiqueta: "¿Hay algo que el asesor nunca deba decir o prometer?" },
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
        etiqueta: "¿Para qué querés el asesor?",
        ayuda: "Marcá todo lo que aplique.",
        opciones: [
          "Responder consultas y precios",
          "Calificar a quien escribe antes de pasarlo a un vendedor",
          "Agendar citas o visitas",
          "Tomar pedidos o reservas",
          "Informar el estado de algo (un pedido, un trámite, una cuenta)",
          "Recibir quejas y derivarlas",
        ],
        otro: true,
      },
      { id: "7.2", tipo: "parrafo", etiqueta: "¿Qué temas tienen que pasar sí o sí a una persona?" },
      {
        id: "7.3",
        tipo: "parrafo",
        etiqueta: "¿Cómo sabés que una consulta vale la pena?",
        ayuda:
          "Qué te hace pensar «este sí va a comprar». Puede ser lo que pide, de dónde viene, cuánto necesita. Es lo que el asesor va a usar para calificar.",
      },
      {
        tipo: "nota",
        texto:
          "Si el asesor tiene que reconocer a alguien —decirle el estado de su pedido, su cuenta o su trámite— hay que definir cómo verifica que es quien dice ser, y hacerlo UNA sola vez. Pedir un dato en cada consulta a alguien que escribe seguido es insoportable.",
      },
      {
        id: "7.4",
        tipo: "una",
        etiqueta: "¿El asesor va a necesitar reconocer a quien escribe?",
        opciones: [
          "Sí, tiene que saber de quién se trata",
          "No, alcanza con responder lo que pregunten",
          "No lo tenemos definido",
        ],
      },
      {
        id: "7.5",
        tipo: "parrafo",
        etiqueta: "Si es que sí, ¿con qué dato lo verificarías? ¿Lo tenés en tu sistema?",
        marcador: "cédula, número de cliente, teléfono registrado…",
      },
    ],
  },
  {
    numero: 8,
    titulo: "Para quien maneja tu sistema",
    entrada:
      "Esta sección es técnica. El asesor puede responder consultas en vivo contra tu sistema —el estado de un pedido, un saldo, una disponibilidad— pero necesita una puerta por donde preguntar.",
    paraQuien: "Podés pasarle esta sección a tu equipo técnico y seguir con la 9.",
    minutos: 1,
    bloques: [
      {
        id: "8.1",
        tipo: "una",
        etiqueta: "¿Usás algún sistema para administrar tu negocio?",
        opciones: [
          "Sí, un sistema propio o a medida",
          "Sí, un sistema comprado",
          "Planillas",
          "No usamos ninguno",
        ],
      },
      { id: "8.2", tipo: "texto", etiqueta: "¿Cuál? ¿Y expone una API o servicio web?" },
      {
        id: "8.3",
        tipo: "parrafo",
        etiqueta: "¿Qué consultas podría responder ese sistema si le preguntamos?",
        marcador: "stock, precios, estado de un pedido, disponibilidad de turnos, saldo de una cuenta…",
      },
      { id: "8.4", tipo: "texto", etiqueta: "¿Quién es el contacto técnico? Nombre, correo y teléfono." },
      {
        tipo: "nota",
        texto:
          "No hace falta que nada de esto esté listo para arrancar. El asesor puede empezar respondiendo lo que no necesita conexión —qué vendés, precios, horarios— y sumar las consultas en vivo cuando la puerta esté disponible.",
      },
    ],
  },
  {
    numero: 9,
    titulo: "WhatsApp y redes",
    minutos: 1,
    bloques: [
      {
        id: "9.1",
        tipo: "una",
        etiqueta: "¿Qué número querés usar?",
        ayuda:
          "Si es el que ya usás, avisanos cuanto antes: conectarlo conservando el WhatsApp del teléfono requiere un trámite con Meta que lleva varios días. No es complicado, pero no es inmediato.",
        opciones: ["El que ya usamos, el que los clientes tienen agendado", "Uno nuevo"],
        requerido: true,
      },
      { id: "9.2", tipo: "texto", etiqueta: "El número, con código de país", requerido: true },
      {
        id: "9.3",
        tipo: "una",
        etiqueta: "¿Querés que el asesor atienda también Instagram y Facebook?",
        ayuda: "Atiende mensajes directos. Los comentarios en publicaciones, por ahora no.",
        opciones: ["Sí", "Por ahora no"],
      },
      { id: "9.4", tipo: "texto", etiqueta: "¿Hacés publicidad hoy? ¿En qué plataformas?" },
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
          "Hay dos niveles. «Configurar»: cambia precios, horarios y cómo habla el asesor, y además atiende. «Solo atender»: ve y contesta conversaciones, no cambia la configuración. Para quien está en el mostrador conviene el segundo — menos permisos no es desconfianza, es que nadie cambie un precio sin querer.",
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
          "Mandá lo que tengas, aunque esté desordenado: logo en buena calidad, lista de precios, fotos de lo que vendés, y sobre todo CAPTURAS DE CONVERSACIONES REALES con clientes (tapando los datos personales). Las capturas son lo más valioso: muestran cómo habla tu gente y cómo pregunta la tuya, y eso no se saca de ningún manual. Anotá acá qué nos vas a mandar.",
      },
    ],
  },
] as const;

/**
 * Las variantes del cuestionario. La clave es lo que viaja en el enlace
 * (`/?v=the-student-store`); sin `?v=` se sirve la general.
 *
 * **El cliente NO elige la variante**: la elige el operador al armar el enlace.
 * Una lista desplegable con los clientes en un formulario público le contaría
 * a cualquiera quiénes son los otros clientes.
 */
export const VARIANTES = {
  general: GENERAL,
  "the-student-store": THE_STUDENT_STORE,
} as const;

export type Variante = keyof typeof VARIANTES;

export const VARIANTE_POR_DEFECTO: Variante = "general";

export function esVariante(v: string | null | undefined): v is Variante {
  return !!v && Object.prototype.hasOwnProperty.call(VARIANTES, v);
}

/** La variante pedida, o la general si no existe. Nunca lanza. */
export function seccionesDe(v: string | null | undefined): readonly Seccion[] {
  return VARIANTES[esVariante(v) ? v : VARIANTE_POR_DEFECTO];
}

export function totalDe(v: string | null | undefined): number {
  return seccionesDe(v).length;
}

/** El total que se le promete al cliente en la primera pantalla. */
export function minutosTotalesDe(v: string | null | undefined): number {
  return seccionesDe(v).reduce((t, s) => t + s.minutos, 0);
}

/**
 * Minutos que faltan al ESTAR en `indice` (0-based), contando la sección
 * actual como pendiente: alguien que está en la primera tiene que ver el total,
 * no el total menos la primera.
 */
export function minutosRestantes(v: string | null | undefined, indice: number): number {
  return seccionesDe(v)
    .slice(Math.max(0, indice))
    .reduce((t, s) => t + s.minutos, 0);
}

/** Los campos de una sección, sin las notas. Para validar y para guardar. */
export function camposDe(seccion: Seccion): readonly Campo[] {
  return seccion.bloques.filter((b): b is Campo => b.tipo !== "nota");
}

