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
 * 131 — La variante para AGENCIAS.
 *
 * Es la primera variante por **rubro** y no por cliente, y la diferencia
 * importa: no nombra a nadie, así que sirve para cualquier agencia que entre
 * y no publica en un repositorio público quién está hablando con nosotros.
 *
 * Una agencia no encaja en la general, y no por vocabulario. La general supone
 * un negocio que quiere un asesor para atender a SUS clientes. Lo que pide una
 * agencia es otra cosa: recuperar las horas que se le van en lo operativo,
 * dejar de hacer a mano lo que podría hacerse solo, y mejorar lo que su cliente
 * recibe. De ahí tres desviaciones deliberadas:
 *
 * 1. **La sección 5 pregunta por HORAS antes que por consultas.** El inventario
 *    de tareas repetitivas con sus horas es, además del insumo del agente, la
 *    línea de base para medir el retorno. Sin el número de partida no hay con
 *    qué comparar a los tres meses, y es un dato que solo existe el día que
 *    alguien lo escribe.
 * 2. **La sección 6 pregunta en nombre de quién habla el agente.** En una
 *    agencia esa pregunta no es de estilo: decide si atiende a los clientes de
 *    la agencia o a los clientes DE sus clientes, y son dos productos.
 * 3. **La 9 y la 10 no piden datos de alta.** Las otras dos variantes son el
 *    paso 0 del alta y por eso piden el correo del propietario y el número a
 *    conectar. Una agencia suele llenar esto **antes de decidir si contrata**, y
 *    pedirle el dueño de la cuenta ahí le presupone la venta. Los datos del alta
 *    se piden cuando hay alta: son los doce pasos de `docs/alta-de-cliente.md`.
 *    **Está declarado acá para que no se lea como un olvido.**
 */
const AGENCIA: readonly Seccion[] = [
  {
    numero: 1,
    titulo: "La agencia, y quién le escribe",
    entrada:
      "Empecemos por el mapa: qué hace la agencia hoy, quién decide esto y quién les escribe. De acá sale todo lo demás.",
    minutos: 2,
    bloques: [
      {
        id: "1.1",
        tipo: "texto",
        etiqueta: "¿A qué se dedica la agencia?",
        marcador: "en una línea, como se lo dirían a alguien que no los conoce",
        requerido: true,
      },
      {
        id: "1.2",
        tipo: "parrafo",
        etiqueta: "¿Quiénes toman esta decisión? Nombre y rol de cada uno.",
        ayuda:
          "Para que la reunión de diagnóstico se arme con las personas que pueden decidir, y no haya que repetirla.",
        requerido: true,
      },
      {
        id: "1.3",
        tipo: "parrafo",
        etiqueta: "¿Cuántas personas son hoy en el equipo, y cómo se reparten?",
        marcador: "socios, cuentas, creativos, pauta, producción, administración…",
      },
      { id: "1.4", tipo: "texto", etiqueta: "¿Cuántos clientes activos atienden a la vez?" },
      {
        tipo: "nota",
        texto:
          "A un mismo número de agencia suelen llegar tres conversaciones que no se parecen en nada: un cliente activo pidiendo una pieza o un reporte, un prospecto preguntando cuánto cobran, y un proveedor o freelance coordinando una entrega. Mezcladas se atienden todas igual de mal, y la del prospecto —la única que trae plata nueva— es la que más se enfría esperando.",
      },
      {
        id: "1.5",
        tipo: "varias",
        etiqueta: "¿Cuáles de esas les escriben hoy al mismo número?",
        opciones: [
          "Clientes activos",
          "Prospectos que todavía no son clientes",
          "Proveedores, freelances y producción",
          "Candidatos buscando trabajo",
        ],
        otro: true,
      },
      {
        id: "1.6",
        tipo: "parrafo",
        etiqueta: "¿Cuál de esas conversaciones les gustaría dejar de atender personalmente?",
        ayuda: "No la que menos importa: la que consume tiempo sin que su criterio agregue nada.",
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
        etiqueta: "¿En qué horario trabaja la agencia?",
        ayuda: "Si en temporada de campañas o cierres de mes cambia, cuéntenlo.",
        requerido: true,
      },
      {
        id: "2.2",
        tipo: "tabla",
        etiqueta: "¿En qué horario hay personas disponibles para responder un WhatsApp?",
        ayuda:
          "El agente contesta siempre. Esto es para saber cuándo puede prometer que alguien va a mirar un caso.",
        columnas: ["Desde", "Hasta"],
        filas: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
      },
      {
        id: "2.3",
        tipo: "parrafo",
        etiqueta: "¿Hay clientes que escriben fuera de hora y esperan respuesta igual?",
        ayuda:
          "Es donde un agente rinde más: no por contestar rápido, sino por evitar que alguien del equipo esté mirando el teléfono un domingo.",
      },
    ],
  },
  {
    numero: 3,
    titulo: "Qué vende la agencia",
    minutos: 2,
    bloques: [
      {
        id: "3.1",
        tipo: "parrafo",
        etiqueta: "¿Qué servicios venden? Cuéntennos cómo están organizados.",
        marcador: "estrategia de marca, prensa y reputación, contenidos, social media, influencers, eventos y activaciones, pauta…",
        requerido: true,
      },
      {
        id: "3.2",
        tipo: "varias",
        etiqueta: "¿Cómo cobran cada cosa?",
        opciones: [
          "Abono mensual (fee)",
          "Por proyecto cerrado",
          "Por evento o activación",
          "Porcentaje de la pauta",
          "Por hora",
          "Mixto, según el cliente",
        ],
        otro: true,
      },
      {
        id: "3.3",
        tipo: "una",
        etiqueta: "¿Los precios son públicos?",
        ayuda:
          "No hay respuesta correcta. En servicios profesionales casi nunca conviene decir el número antes de entender el alcance, pero sí conviene decir un rango para no gastar una reunión con quien no puede pagarlo.",
        opciones: [
          "Sí, el agente puede decirlos",
          "Solo un rango o un «desde»",
          "No, primero hay que entender el alcance",
        ],
      },
      {
        id: "3.4",
        tipo: "parrafo",
        etiqueta: "¿Qué tiene que preguntar el agente para saber si un prospecto les sirve?",
        ayuda:
          "Lo que hoy averiguan en los primeros cinco minutos de una llamada: rubro, tamaño, presupuesto, si ya trabajaron con una agencia, qué esperan.",
      },
      {
        id: "3.5",
        tipo: "parrafo",
        etiqueta: "¿Hay un cliente que NO quieran? ¿Cómo se reconoce temprano?",
        ayuda: "Decir no rápido vale tanto como decir sí rápido, y es lo que un agente puede hacer sin desgastar a nadie.",
      },
    ],
  },
  {
    numero: 4,
    titulo: "Cómo les pagan, y cómo cobran",
    minutos: 2,
    bloques: [
      {
        id: "4.1",
        tipo: "parrafo",
        etiqueta: "Expliquen paso a paso cómo les paga un cliente",
        ayuda: "Desde la factura hasta que el pago queda registrado. Como se lo contarían a alguien que entra al equipo.",
        requerido: true,
      },
      {
        id: "4.2",
        tipo: "una",
        etiqueta: "¿Les pasa que un abono mensual se atrasa?",
        opciones: ["Seguido", "A veces", "Casi nunca"],
      },
      {
        tipo: "nota",
        texto:
          "La cobranza es el caso donde más claro se ve el retorno, porque se mide solo: la cartera al día es un número que ya existe y no hay que inventarlo. El patrón que usamos son dos agentes y no uno — el del tramo por vencer avisa y acompaña, y el del vencido es otro problema, con otro tono y otros límites, porque ahí ya hay un conflicto. Mezclarlos en un solo agente es lo que lo hace fallar.",
      },
      {
        id: "4.3",
        tipo: "una",
        etiqueta: "¿Les interesaría que un agente haga el seguimiento de cobranza?",
        opciones: [
          "Sí, es uno de los dolores",
          "Nos interesa pero no es lo primero",
          "No, eso lo queremos seguir haciendo nosotros",
        ],
      },
      {
        id: "4.4",
        tipo: "parrafo",
        etiqueta: "¿Quién persigue hoy un pago atrasado, y cuánto tiempo le lleva por semana?",
      },
    ],
  },
  {
    numero: 5,
    titulo: "Lo que les come las horas",
    entrada:
      "Esta es la sección más importante, y es la que contesta dónde está el retorno. Para recuperar las horas que se van en lo operativo hace falta saber cuáles son esas horas HOY, porque dentro de tres meses nadie se va a acordar de cuántas eran. Escríbanlas aunque sean estimadas: una estimación anotada vale, una que quedó en la cabeza no.",
    minutos: 5,
    bloques: [
      {
        id: "5.1",
        tipo: "tabla",
        etiqueta: "Las tareas que más horas les consumen, quién las hace y cuántas horas por semana",
        ayuda:
          "Las operativas y repetitivas, no las creativas: armar reportes de prensa o clipping, llenar calendarios de contenido, pedir materiales, pasar piezas a aprobación y perseguir esas aprobaciones, coordinar influencias o proveedores, cargar pauta, responder lo mismo a cinco clientes. Esta tabla es la línea de base del retorno.",
        columnas: ["La tarea", "Quién la hace hoy", "Horas por semana"],
        filas: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
      {
        id: "5.2",
        tipo: "tabla",
        etiqueta: "Lo que más les preguntan los clientes, y cómo lo contestan hoy",
        ayuda: "Escríbanlas como las contestan de verdad, sin arreglarlas. De acá sale casi toda la calidad del agente.",
        columnas: ["Lo que pregunta el cliente", "Cómo lo contestan hoy"],
        filas: ["1", "2", "3", "4", "5", "6", "7", "8"],
      },
      {
        tipo: "nota",
        texto:
          "Conviene separar dos tipos de dolor: hay uno grande, el que mueve la aguja pero cuesta meses, y hay pequeñas victorias que se resuelven en días. Se empieza por una victoria rápida mientras se construye la grande — así el equipo ve que funciona antes de que haya que defender la inversión.",
      },
      {
        id: "5.3",
        tipo: "parrafo",
        etiqueta: "De todo eso, ¿cuál es el dolor grande?",
        ayuda: "El que si se resolviera cambiaría cómo opera la agencia, aunque lleve meses.",
      },
      {
        id: "5.4",
        tipo: "parrafo",
        etiqueta: "¿Y cuál sería una victoria rápida?",
        ayuda: "Algo que les saque horas la semana que viene, aunque sea chico.",
      },
      {
        id: "5.5",
        tipo: "parrafo",
        etiqueta: "¿Qué trabajo hace hoy alguien junior que preferirían que no ocupara a una persona?",
        ayuda:
          "La idea no es tener menos gente: es que la gente que está haga trabajo de mayor nivel. ¿Qué tarea liberarían primero?",
      },
    ],
  },
  {
    numero: 6,
    titulo: "En nombre de quién habla, y cómo",
    entrada:
      "En una agencia esta pregunta no es de estilo. Define si el agente atiende a los clientes de la agencia, o a los clientes DE sus clientes — y son dos cosas distintas, con dos configuraciones distintas.",
    minutos: 1,
    bloques: [
      {
        id: "6.1",
        tipo: "una",
        etiqueta: "¿A quién tiene que atender el agente?",
        ayuda:
          "Si es lo segundo, no es un agente: es uno por cada cliente, con su marca y su número. Eso se puede, y de hecho es la forma en que una agencia revende esto — pero conviene decidirlo antes y no después.",
        opciones: [
          "A los clientes de la agencia, y al equipo interno",
          "A los clientes DE nuestros clientes, con la marca de cada uno",
          "Las dos cosas, en etapas",
        ],
        requerido: true,
      },
      { id: "6.2", tipo: "texto", etiqueta: "¿Cómo se va a llamar el agente?", requerido: true },
      {
        id: "6.3",
        tipo: "una",
        etiqueta: "¿Cómo tratan a sus clientes?",
        opciones: ["De usted", "De vos", "De tú"],
      },
      {
        id: "6.4",
        tipo: "una",
        etiqueta: "¿Qué tono?",
        ayuda:
          "Están hablando con dueños y gerentes de otras empresas. Un tono demasiado informal resta autoridad; uno demasiado rígido no se parece a cómo habla una agencia.",
        opciones: ["Cercano y cálido", "Profesional y directo", "Formal"],
      },
      {
        id: "6.5",
        tipo: "parrafo",
        etiqueta: "¿Hay algo que el agente nunca deba decir o prometer?",
        marcador: "plazos de entrega, resultados de campaña, precios cerrados, nombres de otros clientes…",
      },
    ],
  },
  {
    numero: 7,
    titulo: "Qué tiene que lograr, y cómo van a medir que funcionó",
    minutos: 3,
    bloques: [
      {
        id: "7.1",
        tipo: "varias",
        etiqueta: "¿Para qué quieren los agentes?",
        ayuda: "Marquen todo lo que aplique. Si algo de esta lista no sabían que se podía, es buena señal: por eso está.",
        opciones: [
          "Calificar prospectos antes de que lleguen a un socio",
          "Atender pedidos de clientes activos (materiales, estados, reportes)",
          "Armar y mandar los reportes periódicos",
          "Seguimiento de cobranza",
          "Agendar reuniones",
          "Coordinar con proveedores, freelances e influencers",
          "Tareas internas de producción (briefs, checklists, pases a aprobación)",
          "Juntar y ordenar el clipping o las menciones de prensa",
        ],
        otro: true,
      },
      {
        tipo: "nota",
        texto:
          "Hay algo que casi todas las agencias piden y que NO es un agente de WhatsApp, así que vale separarlo: en vez de mandarle el informe del mes en PPT al cliente, que el cliente entre a un tablero en línea, vea al día sus métricas, su clipping o sus menciones, y se descargue solo las piezas aprobadas, sin tener que pedírselas a nadie del equipo. Eso es un portal de cliente: es otro entregable, con otro costo y otro plazo.",
      },
      {
        id: "7.2",
        tipo: "una",
        etiqueta: "El portal donde el cliente se sirve solo, ¿dónde lo ponen?",
        opciones: [
          "Es la prioridad: es lo que más mejora la experiencia de nuestros clientes",
          "Lo queremos, pero después de lo operativo",
          "Es interesante y no urgente",
        ],
      },
      {
        id: "7.3",
        tipo: "parrafo",
        etiqueta: "Si ese portal existiera, ¿qué tendría que poder hacer un cliente sin escribirle a nadie?",
        marcador: "ver el reporte del mes, descargar piezas aprobadas, ver en qué va un pedido, pasar material a un proveedor…",
      },
      {
        id: "7.4",
        tipo: "tabla",
        etiqueta: "¿Cómo van a medir que esto funcionó?",
        ayuda:
          "Para traducir la incorporación en beneficio económico. Puede ser horas liberadas por semana, costo de nómina evitado, clientes atendidos por persona, tiempo de respuesta, cartera al día. Elijan dos o tres y digan cuánto valen hoy.",
        columnas: ["Lo que vamos a medir", "Cuánto vale hoy", "A cuánto queremos llegar"],
        filas: ["1", "2", "3"],
      },
      {
        id: "7.5",
        tipo: "parrafo",
        etiqueta: "¿Qué temas tienen que pasar sí o sí a una persona?",
      },
      {
        tipo: "nota",
        texto:
          "Lo que armamos para una agencia puede salir con SU marca y entregárselo a sus clientes como producto propio, no como algo nuestro revendido. Si ese camino les interesa, cambia cómo conviene configurar todo desde el principio — por eso se pregunta ahora y no en seis meses.",
      },
      {
        id: "7.6",
        tipo: "una",
        etiqueta: "¿Les interesa revender esto a sus clientes con su propia marca?",
        opciones: [
          "Sí, es parte de por qué nos interesa",
          "Primero queremos resolver lo nuestro",
          "No es nuestro negocio",
        ],
      },
    ],
  },
  {
    numero: 8,
    titulo: "Para quien maneja sus herramientas",
    entrada:
      "Esta sección es técnica. El agente puede responder contra las herramientas que ya usan —el estado de una campaña, un reporte, una planilla— pero necesita una puerta por donde preguntar.",
    paraQuien: "Pueden pasarle esta sección a quien maneje sus sistemas y seguir con la 9.",
    minutos: 1,
    bloques: [
      {
        id: "8.1",
        tipo: "varias",
        etiqueta: "¿Qué usan hoy para trabajar?",
        opciones: [
          "Un CRM",
          "Planillas",
          "Gestor de proyectos o tareas",
          "Drive o similar para los materiales",
          "Meta Business y administradores de pauta",
          "Monitoreo de prensa, clipping o escucha social",
          "Herramienta de reportes o dashboards",
        ],
        otro: true,
      },
      {
        id: "8.2",
        tipo: "parrafo",
        etiqueta: "¿Cuáles, con nombre? ¿Alguna expone una API?",
        ayuda: "Si probaron algo y lo abandonaron, cuéntenlo también: lo abandonado informa tanto como lo que quedó.",
      },
      {
        id: "8.3",
        tipo: "parrafo",
        etiqueta: "¿Dónde vive hoy la información de un cliente?",
        marcador: "en una planilla, en el Drive, en el WhatsApp de alguien, en la cabeza de alguien…",
      },
      { id: "8.4", tipo: "texto", etiqueta: "¿Quién es el contacto técnico? Nombre, correo y teléfono." },
      {
        tipo: "nota",
        texto:
          "No hace falta que nada de esto esté listo para arrancar. El agente puede empezar por lo que no necesita conexión —calificar prospectos, responder lo que se repite, agendar— y sumar las consultas en vivo cuando la puerta esté disponible.",
      },
    ],
  },
  {
    numero: 9,
    titulo: "Canales",
    minutos: 1,
    bloques: [
      {
        id: "9.1",
        tipo: "tabla",
        etiqueta: "¿Por dónde les escriben hoy, y por dónde querrían que el agente atienda?",
        columnas: ["¿Lo usan hoy?", "¿Que el agente atienda ahí?"],
        filas: ["WhatsApp", "Instagram", "Facebook", "Correo", "Teléfono"],
      },
      {
        id: "9.2",
        tipo: "texto",
        etiqueta: "¿Cuántos mensajes reciben por día, más o menos?",
        marcador: "un número grueso alcanza: diez, cincuenta, doscientos",
      },
      {
        id: "9.3",
        tipo: "una",
        etiqueta: "¿Usan un número solo o varios?",
        ayuda:
          "No lo preguntamos para conectar nada todavía, pero sí para poder decirles un plazo real: si el número que quieren usar es el que sus clientes ya tienen agendado, conectarlo conservando el WhatsApp del teléfono requiere un trámite con Meta que lleva varios días. No es complicado, pero no es inmediato, y conviene saberlo antes.",
        opciones: [
          "Uno solo, en un teléfono del equipo",
          "Uno solo, en una central o centralita",
          "Varios, uno por persona o por área",
        ],
      },
      {
        id: "9.4",
        tipo: "parrafo",
        etiqueta: "¿Hacen pauta o comunicación para ustedes mismos, o solo para clientes?",
        ayuda:
          "Si un prospecto llega desde un anuncio propio, el agente puede saber de qué anuncio vino y atenderlo distinto. Para una agencia eso además es una demostración vendible.",
      },
    ],
  },
  {
    numero: 10,
    titulo: "Materiales, y quién viene a la reunión",
    entrada:
      "Lo último, y lo más corto. Esto no pide accesos ni datos de cuenta: eso se ve si deciden avanzar, y recién entonces.",
    minutos: 1,
    bloques: [
      {
        id: "10.1",
        tipo: "parrafo",
        etiqueta: "¿Quiénes van a estar en la reunión de diagnóstico?",
        ayuda:
          "Calculen entre 60 y 70 minutos. Tiene que estar alguien que tenga TODA la información del negocio — si falta ese dato en la reunión, la reunión se repite.",
      },
      {
        id: "10.2",
        tipo: "parrafo",
        etiqueta: "Materiales",
        ayuda:
          "Manden lo que tengan, aunque esté desordenado: su presentación de servicios y el logo. Y dos cosas que para una agencia valen más que el resto — UNO de los reportes que les mandan hoy a un cliente, tal cual, sin arreglarlo, porque es lo que habría que reemplazar y no se puede proponer con qué reemplazar algo que no vimos; y CAPTURAS DE CONVERSACIONES REALES con clientes y con prospectos, tapando los datos personales. Las capturas muestran cómo habla su gente y cómo pregunta la de ellos, y eso no se saca de ningún manual.",
      },
      {
        tipo: "nota",
        texto:
          "Si prefieren no compartir material antes de definir si avanzan, se entiende y no bloquea nada: lo vemos en la reunión, en pantalla, sin que nos quede copia.",
      },
      {
        id: "10.3",
        tipo: "parrafo",
        etiqueta: "¿Hay algo que no preguntamos y creen que deberíamos saber?",
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
  agencia: AGENCIA,
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

