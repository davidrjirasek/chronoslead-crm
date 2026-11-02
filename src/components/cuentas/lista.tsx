import { BrandMark } from "@/components/brand-mark";
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
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <header className="flex flex-wrap items-center gap-3">
        <BrandMark />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Tus cuentas</h1>
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
    </main>
  );
}
