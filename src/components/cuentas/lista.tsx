import { Salir } from "@/components/admin/salir";

const ETIQUETA_ROL: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};

/**
 * 138 — La lista, y nada más.
 *
 * Cada fila es un enlace a la dirección de esa cuenta. NO es un pase: al
 * llegar, ese host pide la contraseña. Las sesiones están encerradas por host a
 * propósito —es el segundo candado del aislamiento— y un atajo entre hosts
 * sería justo la puerta que ese candado cierra.
 */
export function ListaDeCuentas({
  correo,
  base,
  appBaseUrl,
  organizaciones,
}: {
  correo: string;
  base: string;
  appBaseUrl: string;
  organizaciones: { slug: string | null; nombre: string; rol: string }[];
}) {
  let protocolo = "https";
  let puerto = "";
  try {
    const u = new URL(appBaseUrl);
    protocolo = u.protocol.replace(":", "");
    puerto = u.port ? `:${u.port}` : "";
  } catch {
    // Sin APP_BASE_URL utilizable: https y sin puerto, lo correcto en producción.
  }

  return (
    <main className="cl-marca min-h-screen pb-16">
      {/* 138 — La misma barra que el panel de plataforma: esta página es parte
          del producto, no una pantalla suelta. El isotipo va acotado a 36px —
          `BrandMark` sin tamaño se dibuja del porte de la pantalla. */}
      <div className="cl-superficie border-b border-line">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-5 py-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.png" alt="" aria-hidden className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold leading-tight tracking-tight">
              Chronos<span className="text-brand">Lead</span>
            </p>
            <p className="text-[11px] text-text-3">Tus cuentas</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">Elegí a cuál entrar</h1>
          <p className="text-xs text-text-3">{correo}</p>
        </div>
        <Salir />
      </header>

      {organizaciones.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line p-4 text-sm text-text-3">
          Tu cuenta todavía no pertenece a ninguna. Si esperabas ver algo acá,
          escribile a quien te dio de alta.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {organizaciones.map((o) => (
            <li key={o.slug ?? o.nombre}>
              <a
                href={`${protocolo}://${o.slug}.${base}${puerto}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.nombre}</p>
                  <p className="truncate text-xs text-text-3">
                    {o.slug}.{base}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-text-3">
                  {ETIQUETA_ROL[o.rol] ?? o.rol}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-snug text-text-3">
        Cada cuenta te va a pedir tu contraseña la primera vez de la semana. Es
        la misma de siempre: las sesiones se guardan por dirección, a propósito,
        para que la de un cliente no sirva en la de otro.
      </p>
      </div>
    </main>
  );
}
