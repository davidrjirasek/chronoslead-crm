import Image from "next/image";
import Link from "next/link";
import { LeadForm } from "@/app/(public)/lead-form";

/*
 * Landing pública premium (Feature 009) — v2, restyle sobrio. La primera pasada portaba el
 * diseño de Claude Design (ChronosLead Landing v3.dc.html) casi literal: tipografía enorme,
 * secciones alternando negro puro / blanco puro, CTA verde de WhatsApp repetido seis veces.
 * El dueño la vio en vivo y no le convenció — se sentía "agencia ruidosa", no el producto
 * sobrio que ya existe en el CRM y el login. Esta versión ancla todo en la paleta real del
 * producto (crema/blanco, naranja como acento, oscuro solo como bookend en el cierre),
 * reemplaza el mockup de chat inventado por una captura real del Pipeline, eleva la tesis
 * "a tiempo y a medida" con un contraste explícito contra los CRM genéricos, y fija el precio
 * real como referencia (no el placeholder [USD X] del diseño original).
 */

// El número de la Cloud API: es el que atiende el agente. El 976 quedó
// fuera a propósito — vive en la app del teléfono, nadie lo atiende aquí.
const WHATSAPP_NUMBER = "595987550109";
const waLink = (texto: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
const CTA_TEXT = "Hola, quiero agendar mi diagnóstico gratuito de ChronosLead";
// Distinto a propósito: en la bandeja se reconoce de qué botón vino el lead.
const CTA_AGENTE = "Hola, quiero probar el asesor digital de ChronosLead";

const NAV_LINKS = [
  { href: "#solucion", label: "La solución" },
  { href: "#incluye", label: "Qué incluye" },
  { href: "#casos", label: "Casos" },
  { href: "#oferta", label: "Oferta" },
  { href: "#preguntas", label: "Preguntas" },
];

const TRUST = [
  "WhatsApp Oficial · Meta Tech Provider",
  "Diagnóstico sin costo",
  "Hecho en Paraguay",
];

const PILARES = [
  {
    k: "A medida",
    t: "Se adapta a tu negocio. No al revés.",
    x: "No es una plantilla que te calzamos a la fuerza. En el diagnóstico escuchamos qué necesita tu negocio y sumamos los módulos de tu rubro a tu versión.",
    d: "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z",
  },
  {
    k: "A tiempo",
    t: "Ágil. Lo usás desde el día uno.",
    x: "En un kickoff de 20 minutos tu equipo ya lo está usando. Sin curvas de aprendizaje eternas ni funciones de relleno que nadie toca.",
    d: "M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  },
  {
    k: "Consultivo",
    t: "Te acompañamos, no te dejamos solo.",
    x: "El diagnóstico es parte de la oferta, antes de cobrarte nada. No te vendemos una licencia y te deseamos suerte: te entregamos un sistema que funciona.",
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9",
  },
];

const PAINS = [
  {
    t: "Respuestas tardías.",
    x: "Un lead que espera horas ya no es un lead caliente.",
    d: "M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  },
  {
    t: "Leads sin seguimiento.",
    x: "Nadie sabe quién escribió, qué preguntó ni cuándo volver a contactarlo.",
    d: "M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z",
  },
  {
    t: "Herramientas desconectadas.",
    x: "Meta, WhatsApp, Excel y la agenda, cada uno por su lado.",
    d: "M4 4h7v7H4z M13 4h7v4h-7z M13 11h7v9h-7z M4 14h7v6H4z",
  },
];

const STEPS = [
  {
    n: "1",
    t: "El anuncio.",
    x: "Tu campaña en Meta lleva al cliente directo a tu WhatsApp.",
    d: "M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z M17 8a5 5 0 0 1 0 8",
  },
  {
    n: "2",
    t: "El asesor IA.",
    x: "Responde en segundos con el contexto de tu negocio y califica al lead.",
    d: "M12 3v3 M7 6h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M9 11h.01 M15 11h.01 M9.5 14.5h5",
  },
  {
    n: "3",
    t: "El pipeline.",
    x: "El contacto avanza solo por las etapas: nuevo, en conversación, calificado, cita.",
    d: "M3 4h18l-7 8v6l-4 2v-8z",
  },
  {
    n: "4",
    t: "La cita.",
    x: "Queda agendada en tu calendario, con recordatorio automático al cliente.",
    d: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  },
  /*
   * 129 — El quinto paso faltaba en la landing y sí está en la propuesta
   * comercial. Sin él, el recorrido terminaba en la cita y dejaba sin decir lo
   * único que al dueño de un negocio le importa: que la venta se cierra.
   */
  {
    n: "5",
    t: "La venta.",
    x: "Tu vendedor recibe el lead listo y el CRM lo sigue hasta el cierre.",
    d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8.5 12.5l2.5 2.5 4.5-5",
  },
];

const MODULES = [
  {
    k: "Bandeja unificada",
    t: "WhatsApp, Instagram y Facebook, en un solo lugar",
    x: "Todos los mensajes y comentarios de tus redes, concentrados — sin saltar de app en app.",
    logos: true,
  },
  {
    k: "Campañas → WhatsApp",
    t: "Tus anuncios, conectados",
    x: "Cada lead de Meta entra a tu WhatsApp y al CRM con su origen identificado.",
    d: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  },
  {
    k: "Asesor IA",
    t: "Un asesor que no duerme",
    x: "Atiende, responde dudas, califica y agenda, 24/7 y con el tono de tu marca.",
    d: "M12 3v3 M7 6h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M9 11h.01 M15 11h.01 M9.5 14.5h5",
  },
  {
    k: "Calendario automático",
    t: "Citas que se agendan solas",
    x: "La IA ofrece tus horarios libres y confirma. Vos solo te presentás.",
    d: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  },
  {
    k: "Pipeline de seguimiento",
    t: "Ningún lead se queda atrás",
    x: "Ves cada oportunidad por etapa y sabés exactamente a quién llamar hoy.",
    d: "M3 4h18l-7 8v6l-4 2v-8z",
  },
  {
    k: "CRM de contactos",
    t: "Toda tu cartera, ordenada",
    x: "Historial, conversaciones y datos de cada cliente en un solo perfil.",
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9",
  },
  {
    k: "WhatsApp Oficial",
    t: "Tu número, profesional y seguro",
    x: "API oficial de Meta: varias personas de tu equipo en un número, sin riesgo de bloqueo.",
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
];

const VILLANO = [
  {
    rubro: "La compra",
    them: "Elegís un plan, ponés la tarjeta, te cobran — y arreglate.",
    us: "Primero un diagnóstico de valor. Vemos que te sirva antes de cobrarte nada.",
  },
  {
    rubro: "Se adapta",
    them: "Tu negocio se amolda al software.",
    us: "El software se amolda a tu negocio.",
  },
  {
    rubro: "Aprenderlo",
    them: "Semanas de tutoriales y capacitación.",
    us: "Un kickoff de 20 minutos y tu equipo lo usa.",
  },
  {
    rubro: "Uso real",
    them: "Pagás por mil funciones; usás tres.",
    us: "Solo lo que tu negocio necesita. Nada de relleno.",
  },
];

const CAMPANIA = [
  "Oferta irresistible",
  "Anuncios en video",
  "Piezas estáticas",
  "Configuración de campañas en Meta",
];

const CASOS = [
  {
    img: "/landing/caso-colegio.png",
    alt: "Colegio moderno en Paraguay",
    rubro: "Educación",
    n: "+200 %",
    t: "de crecimiento en matrículas",
    x: "En menos de 3 años.",
  },
  {
    img: "/landing/caso-muebleria.png",
    alt: "Living con mobiliario premium",
    rubro: "Mobiliario premium",
    n: "Ventas ↑",
    t: "Posicionamiento de marca + aumento sostenido de ventas",
    x: "",
  },
  {
    img: "/landing/caso-inmobiliaria.png",
    alt: "Edificio residencial moderno",
    rubro: "Inmobiliaria",
    n: "+150 %",
    t: "de crecimiento en participación de mercado",
    x: "",
  },
  {
    img: "/landing/caso-universidad.png",
    alt: "Campus universitario",
    rubro: "Educación superior",
    n: "+2.000",
    t: "leads calificados",
    x: "En 6 meses.",
  },
];

const IMPLEMENTACION = [
  { n: "01", t: "Diagnóstico.", x: "Entendemos tus objetivos, procesos, horarios y clientes." },
  {
    n: "02",
    t: "Configuración a medida.",
    x: "Entrenamos tu asesor IA, conectamos tus anuncios, tu calendario y tus horarios, y armamos tu pipeline y CRM.",
  },
  {
    n: "03",
    t: "Activación de WhatsApp Oficial.",
    x: "Gestionamos la aprobación con Meta; mientras tanto, dejamos listo todo lo demás.",
  },
  {
    n: "04",
    t: "Kickoff y lanzamiento.",
    x: "En 20 minutos tu equipo lo está usando. Salimos en vivo y optimizamos con vos.",
  },
];

const NICHOS = [
  {
    img: "/landing/rubro-restaurante.png",
    alt: "Cliente pidiendo por WhatsApp en un restaurante",
    t: "Restaurantes y delivery",
    x: "Menú con precios dentro del chat, para que el cliente elija y el asesor IA tome el pedido.",
  },
  {
    img: "/landing/rubro-inmobiliaria.png",
    alt: "Pareja mirando propiedades en el celular",
    t: "Inmobiliarias",
    x: "Catálogo de propiedades filtrado por zona y presupuesto.",
  },
  {
    img: "/landing/rubro-educacion.png",
    alt: "Estudiante consultando por WhatsApp",
    t: "Educación",
    x: "Carreras, cuotas y fechas de inscripción a mano del asesor IA.",
  },
  {
    img: "/landing/rubro-salud.png",
    alt: "Recepcionista de un centro de estética",
    t: "Salud y estética",
    x: "Servicios con duración y agenda por profesional.",
  },
];

const FAQ = [
  {
    q: "¿La IA va a sonar como un robot?",
    a: "No. La entrenamos con la información, el tono y las respuestas reales de tu negocio. Y cuando una conversación necesita a una persona, la deriva a tu equipo.",
  },
  {
    q: "¿Pierdo mi número de WhatsApp actual?",
    a: "Podés usar tu número actual o uno nuevo. Al ser WhatsApp Oficial, varios miembros de tu equipo atienden desde el mismo número.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. Nosotros configuramos todo y capacitamos a tu equipo.",
  },
  {
    q: "¿Cuánto tarda en estar funcionando?",
    a: "El setup del asesor IA, el calendario, el pipeline y el CRM lo hacemos nosotros. El único plazo que no depende de nosotros es la aprobación de WhatsApp Oficial por parte de Meta, que a veces tarda entre 20 y 25 días; mientras tanto avanzamos con todo lo demás.",
  },
  {
    q: "¿Y si todavía no tengo anuncios?",
    a: "Los creamos con Creativo 4D Group: oferta, piezas en video y estáticas, y pauta.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Cada cliente tiene su propia instancia aislada, y la integración usa la API oficial de Meta.",
  },
  {
    q: "¿Pueden agregar funciones especiales para mi rubro?",
    a: "Sí. Desarrollamos microservicios a medida, por ejemplo un menú con precios para restaurantes que tus clientes consultan dentro del chat. Se cotizan aparte.",
  },
  {
    q: "¿Quién me responde si escribo al WhatsApp de esta página?",
    a: "Nuestro equipo comercial, directo. Es la mejor forma de contarte cómo el asesor IA atendería después a tus propios clientes.",
  },
  {
    q: "¿El precio que muestran es fijo?",
    a: "Es una referencia. El número final se define en el diagnóstico, sobre la versión a medida de tu negocio.",
  },
];

function IconoPath({ d }: { d: string }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function WhatsappIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8C11.6 28.4 13.8 29 16 29c7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.4c-2 0-4-.5-5.7-1.6l-.4-.2-4 1.1 1.1-3.9-.3-.4A10.9 10.9 0 1 1 16 26.4z" />
      <path d="M22.1 18.6c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6 0-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.1 1.3 3.3c.2.2 2.3 3.5 5.6 4.9.8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.3z" />
    </svg>
  );
}

function FacebookIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M29 16a13 13 0 1 0-15 12.84V19.9h-3.26V16H14v-2.97c0-3.22 1.92-5 4.85-5 1.4 0 2.87.25 2.87.25v3.15h-1.62c-1.6 0-2.1.99-2.1 2v2.4H21.6l-.57 3.9H17.98v8.94A13 13 0 0 0 29 16z" />
    </svg>
  );
}

function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="24" height="24" rx="6.5" />
      <circle cx="16" cy="16" r="5.5" />
      <circle cx="22.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Insignia circular con el color real de cada canal — a diferencia de los íconos de línea
 * del resto de la página (acá importa el reconocimiento de marca, no la consistencia visual). */
function ChannelBadge({
  bg,
  className = "",
  children,
}: {
  bg: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_6px_16px_-4px_rgba(11,11,11,.3)] ring-4 ring-white ${className}`}
      style={{ background: bg }}
    >
      {children}
    </span>
  );
}

/** CTA primario de marca — naranja sólido, un solo lenguaje de color para "actuar" en toda
 * la página. El verde de WhatsApp queda reservado para el único botón flotante. */
function CtaPrimario({
  texto = CTA_TEXT,
  children,
  className = "",
}: {
  texto?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={waLink(texto)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary font-bold text-white shadow-[0_10px_24px_-8px_rgba(255,106,0,.55)] transition hover:bg-[#E24D00] active:scale-[.98] ${className}`}
    >
      {children}
    </a>
  );
}


export function LandingPublica() {
  return (
    <div className="bg-[#FFFCF8] font-sans text-ink">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-black/5 border-b bg-[#FFFCF8]/90 px-5 py-3.5 backdrop-blur-xl sm:px-10 sm:py-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/isotipo.png"
            alt=""
            width={30}
            height={30}
            unoptimized
            className="h-7 w-7 object-contain"
          />
          <span className="whitespace-nowrap font-extrabold text-[16px] tracking-tight sm:text-[18px]">
            Chronos<span className="text-primary">Lead</span>
          </span>
        </div>
        <nav className="hidden items-center gap-7 font-semibold text-[13px] text-zinc-600 lg:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <CtaPrimario className="whitespace-nowrap px-3.5 py-2 text-[12px] sm:px-5 sm:py-2.5 sm:text-[13px]">
            Agendá tu diagnóstico
          </CtaPrimario>
        </div>
      </header>

      {/* ---- Hero: claro, convence sin necesidad de scroll ---- */}
      <section className="relative overflow-hidden border-black/5 border-b bg-[#FFFCF8] bg-[url('/brand/bg-light.jpg')] bg-cover bg-top px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_600px]">
            <div className="min-w-0">
              <p className="font-bold text-[11px] text-primary uppercase tracking-[.18em]">
                Sistema de ventas 360 con IA · Desde Paraguay
              </p>
              <h1 className="mt-4 text-balance font-bold text-[32px] text-ink leading-[1.08] tracking-tight sm:text-[44px] sm:leading-[1.05]">
                El sistema que convierte tus consultas en{" "}
                <span className="text-primary">ventas</span>, ágil y a medida.
              </h1>
              <p className="mt-5 max-w-[500px] text-[15px] text-zinc-600 leading-relaxed sm:text-[16.5px]">
                Un sistema completo —anuncios, asesor IA, agenda y seguimiento— hecho a la medida
                de tu negocio. Ágil, simple, y funcionando en días.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CtaPrimario className="px-6 py-3.5 text-[14.5px]">
                  Agendá tu diagnóstico gratis →
                </CtaPrimario>
                <a
                  href="#solucion"
                  className="flex items-center justify-center gap-2 rounded-full border border-black/15 px-6 py-3.5 font-semibold text-[14px] text-ink transition hover:border-black/30 hover:bg-black/[.03] active:scale-[.98]"
                >
                  Ver cómo funciona
                </a>
              </div>
              <div className="mt-8 flex flex-col gap-y-2.5 gap-x-6 border-black/10 border-t pt-6 font-semibold text-[11.5px] text-zinc-500 sm:flex-row sm:flex-wrap">
                {TRUST.map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative min-w-0">
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_30px_70px_-25px_rgba(11,11,11,.3)] ring-1 ring-black/10">
                <Image
                  src="/landing/hero-pipeline.png"
                  alt="Pipeline real de ChronosLead: contactos organizados por etapa, de Nuevo a Cliente"
                  width={2360}
                  height={1400}
                  sizes="(min-width: 1024px) 600px, 100vw"
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
              <div className="absolute -bottom-5 -left-5 hidden items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-ink shadow-[0_18px_40px_-12px_rgba(255,106,0,.35)] ring-1 ring-black/10 sm:flex">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                  <IconoPath d="M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                </span>
                <div>
                  <p className="font-extrabold text-[12px] leading-none">Nueva cita agendada</p>
                  <p className="mt-1 font-semibold text-[10.5px] text-zinc-500">Automático</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Tesis: a tiempo y a medida ---- */}
      <section
        id="solucion"
        className="border-black/5 border-b bg-white px-5 py-12 sm:px-10 sm:py-16"
      >
        <div className="mx-auto max-w-[1200px]">
          <p className="text-center font-bold text-[11px] text-primary uppercase tracking-[.18em]">
            Tu CRM, a tiempo y a medida
          </p>
          <h2 className="mx-auto mt-3 max-w-[640px] text-balance text-center font-bold text-[24px] text-ink leading-[1.15] sm:text-[30px]">
            No es una plataforma gigante que tenés que aprender. Es tu sistema, construido para vos.
          </h2>
          <div className="mx-auto mt-10 grid max-w-[920px] grid-cols-1 gap-4 sm:grid-cols-3">
            {PILARES.map((p) => (
              <div
                key={p.k}
                className="rounded-2xl border border-black/[.06] bg-[#FFFCF8] p-6 shadow-[0_1px_2px_rgba(11,11,11,.04),0_12px_30px_-20px_rgba(11,11,11,.25)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 text-[#E24D00] ring-1 ring-primary/20">
                  <IconoPath d={p.d} />
                </span>
                <p className="mt-5 font-bold text-[11px] text-primary uppercase tracking-[.14em]">
                  {p.k}
                </p>
                <p className="mt-2 font-bold text-[16px] leading-snug">{p.t}</p>
                <p className="mt-2 text-[13.5px] text-zinc-600 leading-relaxed">{p.x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 01. El problema ---- */}
      <section className="bg-[#FFFCF8] px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-bold text-[11px] text-primary uppercase tracking-[.18em]">
            01. El costo de responder tarde
          </p>
          <h2 className="mt-3 max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Tus anuncios funcionan. El problema empieza después del &ldquo;Hola, quiero más
            info&rdquo;.
          </h2>
          <p className="mt-4 max-w-[600px] text-[14.5px] text-zinc-600 leading-relaxed sm:text-[15.5px]">
            Pagás para que te escriban, pero el mensaje queda sin responder por horas. El lead se
            enfría, le escribe a tu competencia y tu inversión en publicidad se pierde en un chat.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PAINS.map((p) => (
              <div
                key={p.t}
                className="rounded-2xl border border-black/[.06] bg-white p-6 shadow-[0_1px_2px_rgba(11,11,11,.03)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(11,11,11,.3)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 text-[#E24D00] ring-1 ring-primary/20">
                  <IconoPath d={p.d} />
                </span>
                <p className="mt-4 font-bold text-[15.5px]">{p.t}</p>
                <p className="mt-2 text-[13.5px] text-zinc-600 leading-relaxed">{p.x}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[640px] text-balance border-primary border-l-4 pl-5 font-bold text-[17px] text-ink leading-snug sm:text-[20px]">
            No necesitás más leads. Necesitás un sistema que no deje escapar los que ya tenés.
          </p>
        </div>
      </section>

      {/* ---- 02. Cómo funciona ---- */}
      <section className="border-black/5 border-y bg-white px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-bold text-[11px] text-primary uppercase tracking-[.18em]">
            02. De la conversación a la venta
          </p>
          <h2 className="mt-3 max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Todo empieza con un anuncio.{" "}
            <span className="text-primary">Lo que sigue, lo conectamos.</span>
          </h2>
          <div className="mt-9 flex flex-col items-stretch gap-3 lg:flex-row">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="flex min-w-0 flex-1 flex-col items-stretch gap-3 lg:flex-row"
              >
                <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-black/[.06] bg-[#FFFCF8] p-5 shadow-[0_1px_2px_rgba(11,11,11,.03)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                      <IconoPath d={s.d} />
                    </span>
                    <span className="font-bold text-[10.5px] text-zinc-500 uppercase tracking-[.12em]">
                      Paso {s.n}
                    </span>
                  </div>
                  <p className="mt-4 font-bold text-[15.5px]">{s.t}</p>
                  <p className="mt-2 text-[13px] text-zinc-600 leading-relaxed">{s.x}</p>
                </div>
                {i < STEPS.length - 1 ? (
                  <span className="flex shrink-0 rotate-90 items-center justify-center self-center font-bold text-primary text-xl lg:rotate-0">
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Qué incluye ---- */}
      <section id="incluye" className="bg-[#FFFCF8] px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Todo lo que necesitás para vender, en un solo lugar.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {MODULES.map((m) => (
              <div
                key={m.k}
                className="rounded-2xl border border-black/[.06] bg-white p-6 shadow-[0_1px_2px_rgba(11,11,11,.03)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-22px_rgba(255,106,0,.4)]"
              >
                {m.logos ? (
                  <div className="flex items-center">
                    <ChannelBadge bg="#25D366">
                      <WhatsappIcon className="h-5 w-5" />
                    </ChannelBadge>
                    <ChannelBadge
                      bg="linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)"
                      className="-ml-3.5"
                    >
                      <InstagramIcon className="h-5 w-5" />
                    </ChannelBadge>
                    <ChannelBadge bg="#1877F2" className="-ml-3.5">
                      <FacebookIcon className="h-5 w-5" />
                    </ChannelBadge>
                  </div>
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF8F3D] to-[#E24D00] text-white shadow-[0_8px_18px_-6px_rgba(255,106,0,.55)]">
                    <IconoPath d={m.d ?? ""} />
                  </span>
                )}
                <p className="mt-4 font-bold text-[10.5px] text-primary uppercase tracking-[.14em]">
                  {m.k}
                </p>
                <p className="mt-2 font-bold text-[16px] leading-snug">{m.t}</p>
                <p className="mt-2 text-[13.5px] text-zinc-600 leading-relaxed">{m.x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Nosotros vs. los CRM gigantes ---- */}
      <section className="border-black/5 border-y bg-white px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-bold text-[11px] text-primary uppercase tracking-[.18em]">
            El contraste
          </p>
          <h2 className="mt-3 max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Los CRM grandes son lentos y genéricos.{" "}
            <span className="text-primary">Nosotros somos ágiles y a tu medida.</span>
          </h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr>
                  <th className="w-[120px]" />
                  <th className="pb-3 text-left font-bold text-[13px] text-zinc-400">
                    El CRM gigante
                  </th>
                  <th className="pb-3 text-left font-bold text-[13px] text-primary">ChronosLead</th>
                </tr>
              </thead>
              <tbody>
                {VILLANO.map((row) => (
                  <tr key={row.rubro} className="border-black/[.06] border-t">
                    <td className="py-4 pr-3 font-bold text-[10.5px] text-zinc-400 uppercase tracking-[.1em]">
                      {row.rubro}
                    </td>
                    <td className="py-4 pr-5 text-[13.5px] text-zinc-500 leading-snug">
                      {row.them}
                    </td>
                    <td className="rounded-lg bg-orange-50/70 py-4 pr-5 pl-4 font-semibold text-[13.5px] text-ink leading-snug">
                      {row.us}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-8 max-w-[640px] text-balance border-primary border-l-4 pl-5 font-bold text-[17px] text-ink leading-snug sm:text-[20px]">
            Con los grandes pagás primero y aprendés solo. Con nosotros, primero entendemos tu
            negocio.
          </p>
        </div>
      </section>

      {/* ---- Antes / después ---- */}
      <section className="bg-[#FFFCF8] px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Antes vs. después con ChronosLead.
          </h2>
          <div className="mt-8 grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/[.06] bg-white p-6">
              <p className="font-bold text-[10.5px] text-zinc-400 uppercase tracking-[.16em]">
                Sin ChronosLead
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "Respondés cuando podés",
                  "Leads perdidos en el chat",
                  "Agendás ida y vuelta por mensaje",
                  "No sabés qué anuncio vende",
                  "5 herramientas desconectadas",
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 border-black/[.06] border-b pb-3 text-[13.5px] text-zinc-500 last:border-0 last:pb-0"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-bold text-[10.5px] text-zinc-400">
                      ×
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-white p-6 shadow-[0_14px_34px_-24px_rgba(255,106,0,.45)]">
              <p className="font-bold text-[10.5px] text-primary uppercase tracking-[.16em]">
                Con ChronosLead
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "Respuesta en segundos, 24/7",
                  "Cada lead en el pipeline",
                  "La IA agenda sola en tu calendario",
                  "Sabés qué campaña trae citas",
                  "Un solo sistema",
                ].map((a) => (
                  <li
                    key={a}
                    className="flex items-start gap-3 border-black/[.06] border-b pb-3 font-semibold text-[13.5px] text-ink last:border-0 last:pb-0"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10.5px] text-white">
                      ✓
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Campaña ---- */}
      <section className="border-black/5 border-y bg-white px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
                ¿Todavía no tenés anuncios? Te armamos la campaña completa.
              </h2>
              <p className="mt-4 text-[14.5px] text-zinc-600 leading-relaxed sm:text-[15.5px]">
                Con el equipo de Creativo 4D Group creamos todo desde cero: tu oferta irresistible,
                los anuncios en video y estáticos, y la estrategia de pauta.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {CAMPANIA.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-orange-50 px-4 py-2 font-semibold text-[12.5px] text-[#E24D00] ring-1 ring-primary/15"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <CtaPrimario
                texto="Hola, quiero mi campaña y el sistema de ChronosLead"
                className="mt-7 px-6 py-3 text-[13.5px]"
              >
                Quiero mi campaña + sistema →
              </CtaPrimario>
            </div>
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-zinc-200 border-dashed bg-[#FFFCF8] p-6 text-center sm:min-h-[300px]">
              <p className="font-bold text-[11px] text-zinc-400 uppercase tracking-[.14em]">
                Foto pendiente
              </p>
              <p className="mt-2 max-w-[300px] text-[12px] text-zinc-500 leading-relaxed">
                Equipo de Creativo 4D Group grabando un anuncio, clima de producción real.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Casos ---- */}
      <section id="casos" className="bg-[#FFFCF8] px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Resultados reales.{" "}
            <span className="text-primary">Negocios que crecen con ChronosLead.</span>
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CASOS.map((c) => (
              <article
                key={c.t}
                className="group flex flex-col overflow-hidden rounded-2xl border border-black/[.06] bg-white shadow-[0_1px_2px_rgba(11,11,11,.03)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(11,11,11,.3)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={c.img}
                    alt={c.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 font-bold text-[#E24D00] text-[10px] uppercase tracking-[.1em] shadow-sm">
                    {c.rubro}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-extrabold text-[26px] text-primary leading-none">{c.n}</p>
                  <p className="mt-2 font-bold text-[13.5px] leading-snug">{c.t}</p>
                  {c.x ? (
                    <p className="mt-1 text-[12.5px] text-zinc-500 leading-relaxed">{c.x}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Implementación ---- */}
      <section className="border-black/5 border-y bg-white px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Implementación simple. El setup lo hacemos nosotros; vos te dedicás a vender.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {IMPLEMENTACION.map((i) => (
              <div
                key={i.n}
                className="relative rounded-2xl border border-black/[.06] bg-[#FFFCF8] p-6"
              >
                <span className="absolute top-3 right-5 font-extrabold text-[32px] text-zinc-200 leading-none">
                  {i.n}
                </span>
                <p className="relative font-bold text-[15.5px]">{i.t}</p>
                <p className="relative mt-2 text-[13px] text-zinc-600 leading-relaxed">{i.x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Rubros ---- */}
      <section className="bg-[#FFFCF8] px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            No es una plataforma gigante.{" "}
            <span className="text-primary">Es tu sistema, a tu medida.</span>
          </h2>
          <p className="mt-4 max-w-[600px] text-[14.5px] text-zinc-600 leading-relaxed sm:text-[15.5px]">
            Además de todo lo incluido, desarrollamos microservicios especiales para tu negocio: el
            menú de tu restaurante, el catálogo de tu inmobiliaria, la oferta de tu instituto.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NICHOS.map((n) => (
              <article
                key={n.t}
                className="group overflow-hidden rounded-2xl border border-black/[.06] bg-white shadow-[0_1px_2px_rgba(11,11,11,.03)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(11,11,11,.3)]"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <Image
                    src={n.img}
                    alt={n.alt}
                    width={400}
                    height={300}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <p className="font-bold text-[15px]">{n.t}</p>
                  <p className="mt-2 text-[13px] text-zinc-600 leading-relaxed">{n.x}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 font-semibold text-[12.5px] text-zinc-500">
            Se cotizan aparte, según el alcance de cada uno.
          </p>
        </div>
      </section>

      {/* ---- Oferta / precio ---- */}
      <section
        id="oferta"
        className="border-black/5 border-y bg-white px-5 py-12 sm:px-10 sm:py-16"
      >
        <div className="mx-auto max-w-[1200px]">
          <p className="font-bold text-[11px] text-primary uppercase tracking-[.18em]">
            La inversión
          </p>
          <h2 className="mt-3 max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Un sistema completo, a la medida de lo que tu negocio necesita.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            <ul className="space-y-3">
              {[
                "Asesor IA entrenado con tu negocio",
                "WhatsApp Oficial integrado (API de Meta)",
                "Conexión de tus anuncios al WhatsApp",
                "Calendario automático de citas",
                "Pipeline visual de seguimiento",
                "CRM de contactos",
                "Setup completo y módulos a medida de tu rubro",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 border-black/[.06] border-b pb-3 text-[14px] text-ink last:border-0 last:pb-0"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10.5px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-ink p-7 text-white">
              <p className="font-bold text-[10.5px] text-[#FF8F3D] uppercase tracking-[.16em]">
                Inversión de referencia
              </p>
              <p className="mt-3 font-extrabold text-[34px] leading-none sm:text-[38px]">
                Desde ₲ 6.500.000<span className="font-bold text-[16px] text-white/60"> /mes</span>
              </p>
              <p className="mt-2.5 font-semibold text-[13px] text-white/75">
                Setup ₲ 12.000.000 · IVA incluido
              </p>
              <p className="mt-4 rounded-xl bg-white/[0.07] px-4 py-3 text-[12.5px] text-white/85 leading-relaxed">
                <span className="font-bold text-white">Con contrato de 12 meses, el setup va
                bonificado.</span>{" "}
                Con contrato de 6 meses, se fracciona en 6 cuotas sin intereses.
              </p>
              <p className="mt-5 border-white/15 border-t pt-5 text-[12.5px] text-white/65 leading-relaxed">
                El número final lo definimos sobre tu versión a medida, en el diagnóstico.
              </p>
              <CtaPrimario
                texto="Hola, quiero agendar mi diagnóstico de ChronosLead"
                className="mt-6 w-full px-6 py-3.5 text-[14px]"
              >
                Agendá tu diagnóstico →
              </CtaPrimario>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Quién está detrás ---- */}
      <section className="bg-[#FFFCF8] px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="font-bold text-[11px] text-primary uppercase tracking-[.18em]">
                Quién está detrás
              </p>
              <h2 className="mt-3 text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
                Impulsado por <span className="text-primary">Creativo 4D Group.</span>
              </h2>
            </div>
            <p className="text-[14.5px] text-zinc-600 leading-relaxed sm:text-[15.5px]">
              ChronosLead nace de años implementando marketing de resultados y sistemas comerciales
              para empresas en Paraguay. No es un software genérico: es la experiencia de una
              agencia convertida en un sistema que ahora está disponible para tu negocio.
            </p>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section
        id="preguntas"
        className="border-black/5 border-t bg-white px-5 py-12 sm:px-10 sm:py-16"
      >
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[640px] text-balance font-bold text-[22px] text-ink leading-[1.2] sm:text-[28px]">
            Preguntas frecuentes.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FAQ.map((q) => (
              <div key={q.q} className="rounded-2xl border border-black/[.06] bg-[#FFFCF8] p-5">
                <p className="font-bold text-[14.5px] leading-snug">{q.q}</p>
                <p className="mt-2 text-[13px] text-zinc-600 leading-relaxed">{q.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Cierre: el único tramo oscuro, como remate ---- */}
      <section className="relative overflow-hidden bg-ink px-5 py-12 text-white sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <Image
            src="/isotipo.png"
            alt=""
            width={288}
            height={288}
            unoptimized
            className="pointer-events-none absolute -top-16 -right-14 hidden h-64 w-64 object-contain opacity-20 sm:block"
          />
          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_420px]">
            <div className="min-w-0 max-w-[480px]">
              <h2 className="text-balance font-bold text-[26px] leading-[1.12] sm:text-[36px]">
                No te lo contamos. <span className="text-primary">Probalo vos mismo.</span>
              </h2>
              <p className="mt-5 max-w-[480px] text-[14.5px] text-white/70 leading-relaxed sm:text-[15.5px]">
                Escribinos por WhatsApp y coordinamos tu diagnóstico gratuito: una reunión donde
                diseñamos el sistema a la medida de tu negocio.
              </p>
              {/* 113 — Aquí el llamado NO es agendar: es probar. La sección se
                  titula «Probalo vos mismo» y al lado está el formulario para
                  quien prefiere que lo contacten. Dos caminos distintos; dos
                  botones de agendar competirían entre sí.
                  El texto precargado es propio para reconocer en la bandeja
                  que ese lead vino de aquí y no de un botón de diagnóstico. */}
              <a
                href={waLink(CTA_AGENTE)}
                target="_blank"
                rel="noreferrer"
                className="mt-7 flex w-fit items-center justify-center gap-3 rounded-full bg-primary px-7 py-4 font-bold text-[15px] text-white shadow-[0_14px_32px_-10px_rgba(255,106,0,.6)] transition hover:bg-[#E24D00] active:scale-[.98]"
              >
                <WhatsappIcon className="h-[18px] w-[18px]" />
                Conversá con tu asesor digital
              </a>
              <p className="mt-3 text-[13px] text-white/45">
                Te responde en segundos, cualquier día y a cualquier hora.
              </p>
            </div>
            <LeadForm />
          </div>
        </div>
      </section>

      <footer className="bg-ink px-5 py-10 text-white sm:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:gap-6">
            <div>
              <p className="font-extrabold text-[17px]">
                Chronos<span className="text-primary">Lead</span>
              </p>
              <p className="mt-1.5 text-[13px] text-white/60">Tu CRM, a tiempo y a medida.</p>
              <p className="mt-4 text-[12px] text-white/45">Un producto de Creativo 4D Group.</p>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4 text-[13px]">
              <div className="space-y-2">
                <p className="font-bold text-[10.5px] text-primary uppercase tracking-[.14em]">
                  Explorá
                </p>
                <a href="#solucion" className="block text-white/65 transition hover:text-white">
                  La solución
                </a>
                <a href="#incluye" className="block text-white/65 transition hover:text-white">
                  Qué incluye
                </a>
                <a href="#casos" className="block text-white/65 transition hover:text-white">
                  Casos de éxito
                </a>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-[10.5px] text-primary uppercase tracking-[.14em]">
                  Conectá
                </p>
                <a
                  href={waLink(CTA_TEXT)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-white/65 transition hover:text-white"
                >
                  WhatsApp
                </a>
                <a href="#preguntas" className="block text-white/65 transition hover:text-white">
                  Preguntas frecuentes
                </a>
                {/* Sin enlace de ingreso: en la plataforma cada cliente entra por
                    SU subdominio, y el apex no sabe de qué empresa es quien
                    hace clic. Un «Ingresar» genérico solo puede llevar a un
                    error. La frase le dice al cliente lo que necesita saber. */}
                <p className="text-white/45">
                  ¿Ya sos cliente? Entrá en{" "}
                  <span className="text-white/65">tuempresa.chronoslead.com</span>
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-[10.5px] text-primary uppercase tracking-[.14em]">
                  Legal
                </p>
                <Link
                  href="/privacidad"
                  className="block text-white/65 transition hover:text-white"
                >
                  Política de privacidad
                </Link>
                <Link
                  href="/condiciones-servicio"
                  className="block text-white/65 transition hover:text-white"
                >
                  Condiciones del servicio
                </Link>
                <Link
                  href="/eliminacion-datos"
                  className="block text-white/65 transition hover:text-white"
                >
                  Eliminación de datos
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-8 border-white/10 border-t pt-5 text-[11px] text-white/40">
            © 2026 ChronosLead · Un producto de Creativo 4D Group
          </p>
        </div>
      </footer>

      {/* ---- Único verde de la página: el flotante ---- */}
      <div className="pointer-events-none sticky bottom-5 z-50 flex items-end justify-end px-5 sm:px-10">
        <a
          href={waLink(CTA_TEXT)}
          target="_blank"
          rel="noreferrer"
          data-testid="whatsapp-flotante"
          className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-[#25D366] py-3 pr-4 pl-3 shadow-[0_14px_30px_-10px_rgba(37,211,102,.7)] ring-4 ring-[#FFFCF8]"
        >
          <WhatsappIcon className="h-6 w-6 text-white" />
          <span className="hidden font-bold text-[12.5px] text-white leading-tight sm:inline">
            Escribinos
          </span>
        </a>
      </div>
    </div>
  );
}
