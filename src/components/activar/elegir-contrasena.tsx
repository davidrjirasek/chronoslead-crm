"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN = 8;

/**
 * 106 — El cliente elige SU contraseña. Nadie más la conoce, ni el operador.
 *
 * Las dos notas de abajo no son relleno: el cliente final no es técnico, y un
 * producto que le entrega una cuenta sin decirle dónde guardar la llave ni cómo
 * reconocer una suplantación le está dejando el trabajo a él.
 */
export function ElegirContrasena({
  token,
  motivo,
  nombreOrganizacion,
}: {
  token: string;
  motivo: "alta" | "recuperacion";
  nombreOrganizacion: string;
}) {
  const router = useRouter();
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (contrasena !== repetida) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    if (contrasena.length < MIN) {
      setError(`La contraseña debe tener al menos ${MIN} caracteres.`);
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/activar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, contrasena }),
    });
    setEnviando(false);
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => ({}));
      setError(
        cuerpo?.code === "contrasena_corta"
          ? `La contraseña debe tener al menos ${MIN} caracteres.`
          : "Este enlace ya no sirve. Pídele uno nuevo a quien te dio de alta."
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>
          {motivo === "alta"
            ? `Bienvenido a ${nombreOrganizacion}`
            : "Elige una contraseña nueva"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-3">
          {motivo === "alta"
            ? "Elige la contraseña con la que vas a entrar. Solo la sabrás tú: ni siquiera quien te dio de alta puede verla."
            : "Al guardarla, se cerrará cualquier sesión que siga abierta con la contraseña anterior."}
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contrasena">Contraseña</Label>
            <Input
              id="contrasena"
              type="password"
              autoComplete="new-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repetida">Repítela</Label>
            <Input
              id="repetida"
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-text-3">Mínimo {MIN} caracteres.</p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar y entrar"}
          </Button>
        </form>

        <div className="space-y-3 border-t border-line pt-4 text-xs text-text-3">
          <p className="flex gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span>
              <strong className="font-semibold">Guárdala en un lugar seguro.</strong>{" "}
              Lo más cómodo es un gestor de contraseñas: una aplicación que las
              recuerda por ti y las rellena sola. El de tu teléfono o tu navegador
              ya sirve, y te ofrecerá guardarla al entrar.
            </span>
          </p>
          <p className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span>
              <strong className="font-semibold">
                ChronosLead nunca te va a pedir tu contraseña
              </strong>{" "}
              por WhatsApp, por correo ni por teléfono. Si alguien te la pide,
              aunque diga ser del soporte, no se la des.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
