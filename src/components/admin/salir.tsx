"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";

/**
 * 132 — Salir del panel de operador.
 *
 * Faltaba: el cierre de sesión vivía solo en el CRM (`app-nav.tsx`) y el panel
 * no tenía ninguno. La única forma de salir era borrar las cookies del sitio a
 * mano —que además tumba la sesión de TODOS los subdominios, incluido el CRM
 * propio—. Importa de verdad cuando se entra desde una máquina ajena.
 *
 * Va suelto y no dentro de un armazón porque el panel no tiene uno: son tres
 * pantallas, y meterles un armazón para colgar un botón sería más código del
 * que resuelve.
 */
export function Salir() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Salir del panel"
      title="Salir del panel"
      className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3.5 text-sm font-medium text-text-2 transition hover:bg-bg-hover hover:text-foreground"
      onClick={async () => {
        await signOut();
        // `refresh` además del `push`: sin él, la pantalla del panel queda
        // pintada en caché y parece que la sesión siguiera viva.
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="mr-1.5 h-4 w-4" strokeWidth={2} />
      Salir
    </button>
  );
}
