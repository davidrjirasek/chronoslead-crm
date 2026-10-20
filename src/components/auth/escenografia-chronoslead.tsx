import Image from "next/image";

/**
 * 107 — La pantalla de entrada de ChronosLead: dos columnas, tal como la
 * diseñó el dueño en el repositorio anterior (`src/app/app/login/page.tsx`).
 *
 * Es un porte, no una reinterpretación. Los tres fondos (`bg-light`,
 * `bg-dark`, `login-hero`) son los archivos originales.
 *
 * El color viene de los tokens (`text-brand`, `bg-background`) y no de hex
 * sueltos: así la escenografía sigue al acento de la plataforma y no se rompe
 * en el próximo merge de upstream. Los dos negros del panel derecho sí son de
 * marca y se quedan fijos.
 */
export function EscenografiaChronosLead({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen bg-background font-sans text-foreground">
      {/* `gap` + `overflow-y-auto` y no solo `justify-between`: en una pantalla
          corta (375×667) el bloque central se comía el pie y los dos textos se
          superponían. Con hueco mínimo garantizado, en pantallas altas se
          reparte igual y en las bajas se desplaza. */}
      <div className="flex w-full shrink-0 flex-col justify-between gap-8 overflow-y-auto bg-[url('/brand/bg-light.jpg')] bg-cover bg-top px-6 py-8 sm:w-[560px] sm:px-14 lg:w-[640px]">
        <div className="flex items-center gap-1.5">
          {/* unoptimized: es un archivo propio y pequeño; pasarlo por el
              optimizador sería trabajo para no ahorrar. */}
          <Image
            src="/isotipo.png"
            alt=""
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 object-contain"
          />
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight">
              Chronos<span className="text-brand">Lead</span>
            </p>
            <p className="text-[11px] text-text-3">Tu CRM, a tiempo, a medida.</p>
          </div>
        </div>

        <div className="py-2 sm:py-6">{children}</div>

        <p className="shrink-0 text-[11px] text-text-4">
          © 2026 ChronosLead · Un producto de Creativo 4D Group
        </p>
      </div>

      <div className="relative hidden flex-1 overflow-hidden bg-[url('/brand/bg-dark.jpg')] bg-cover bg-center md:block">
        <div className="absolute inset-5 overflow-hidden rounded-3xl ring-1 ring-white/15">
          <Image
            src="/brand/login-hero.jpg"
            alt="Dos personas del equipo comercial revisando el CRM de ChronosLead en una laptop"
            fill
            sizes="(min-width: 768px) 50vw, 0px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8">
            <p className="text-3xl font-extrabold leading-tight text-white">
              Cada oportunidad
              <br />
              en su <span className="text-brand">momento.</span>
            </p>
            <p className="mt-2 text-sm text-white/70">Tu CRM, a tiempo, a medida.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
