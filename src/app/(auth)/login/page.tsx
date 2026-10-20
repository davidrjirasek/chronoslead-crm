"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth/client";
import { useEsPlataforma } from "@/components/auth/edicion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const esPlataforma = useEsPlataforma();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn.email({ email, password });
    setLoading(false);
    if (err) {
      setError(
        err.status === 429
          ? "Demasiados intentos. Espera unos minutos."
          : "Correo o contraseña incorrectos."
      );
      return;
    }
    // A la raíz, no a la Bandeja: ahí se decide si toca la guía de inicio
    // (#86) o la Bandeja de siempre.
    router.push("/");
    router.refresh();
  }

  if (esPlataforma) {
    return (
      <div className="w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Bienvenida de nuevo
        </p>
        <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight">
          Ingresá a tu CRM
        </h1>
        <p className="mt-2 text-sm text-text-3">
          Tus conversaciones, citas y oportunidades te esperan.
        </p>
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-pl">Correo electrónico</Label>
            <Input
              id="email-pl"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-pl">Contraseña</Label>
            <Input
              id="password-pl"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Ingresar →"}
          </Button>
          <p className="text-center text-xs text-text-3">
            El acceso lo da el equipo de ChronosLead. No hay registro abierto.
            <br />
            ¿Olvidaste tu contraseña? Escribile a quien te dio de alta y te
            manda un enlace para elegir una nueva.
          </p>
        </form>
      </div>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
          {esPlataforma ? (
            // 106 — En plataforma no hay registro público: ofrecerlo sería una
            // puerta muerta (404). Lo que hace falta aquí es saber a quién
            // escribir, que es lo que antes no existía en ningún sitio.
            <p className="text-center text-sm text-muted-foreground">
              ¿Olvidaste tu contraseña? Escríbele a quien te dio de alta en
              ChronosLead y te manda un enlace para elegir una nueva.
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              ¿Primera vez aquí?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Crear la cuenta inicial
              </Link>
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
