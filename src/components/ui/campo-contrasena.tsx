"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * 144 — Un campo de contraseña con ojito NUESTRO.
 *
 * Por qué existe: los campos eran `type="password"` pelados, así que el único
 * ojito era el del navegador. Y ese no está siempre: Edge y Chrome en Android
 * lo dibujan, Safari y Chrome de escritorio NO. Lo que ahí se ve es la llave
 * del gestor de contraseñas, que abre el autocompletado y no revela nada — y
 * quien la toca concluye, con razón, que «el ojito no funciona». Lo reportaron
 * clientes eligiendo su contraseña (16-nov-2026).
 *
 * Revelar la contraseña propia mientras uno la escribe no la expone a nadie
 * más: la alternativa real es escribirla a ciegas, equivocarse y no saber por
 * qué no entra. El estado arranca oculto, y vuelve a oculto solo.
 */
export function CampoContrasena({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  // Para que el botón nombre SU campo cuando el `id` no viene de afuera.
  const propio = useId();
  const id = props.id ?? propio;

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        // `pr-10` deja el hueco del botón: sin él, una contraseña larga se
        // mete por debajo del icono y no se lee justo cuando se la revela.
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // `tabIndex={-1}` sería más cómodo al tabular, pero deja el ojito
        // inalcanzable por teclado: es un control, no un adorno.
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        title={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-text-3 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
