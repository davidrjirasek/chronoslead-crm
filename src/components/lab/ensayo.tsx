"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, MessageSquare, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * 140 — El ensayo: hablar con el agente sin que salga nada.
 *
 * El Laboratorio prueba comportamiento con personas y un juez. Esto prueba
 * CONTENIDO: se le pregunta un precio, un horario o una política y se ve qué
 * contesta, con su base de conocimiento real y sin tocar el número del
 * cliente.
 */

type Linea = { id: string; de: "vos" | "agente"; texto: string; en: string };
type Ensayo = {
  conversationId: string;
  lineas: Linea[];
  escalado: { motivo: string | null; en: string } | null;
};

/** Por qué escaló, en palabras de alguien que no leyó el código. */
const MOTIVO: Record<string, string> = {
  manual_reply: "alguien contestó desde el teléfono",
  frase: "el cliente pidió hablar con una persona",
  ventana: "se cerró la ventana de 24 horas",
};

export function EnsayoCard() {
  const [ensayo, setEnsayo] = useState<Ensayo | null>(null);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/lab/ensayo").catch(() => null);
    if (res?.ok) setEnsayo((await res.json()) as Ensayo);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ensayo?.lineas.length]);

  async function enviar() {
    const dicho = texto.trim();
    if (!dicho || pensando) return;
    setTexto("");
    setPensando(true);
    setError(null);
    const res = await fetch("/api/lab/ensayo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texto: dicho }),
    }).catch(() => null);
    setPensando(false);
    if (!res) {
      setError("Sin conexión con el servidor.");
      setTexto(dicho);
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo enviar.");
      setTexto(dicho);
      return;
    }
    setEnsayo((await res.json()) as Ensayo);
  }

  async function reiniciar() {
    setError(null);
    const res = await fetch("/api/lab/ensayo", { method: "DELETE" }).catch(() => null);
    if (res?.ok) setEnsayo((await res.json()) as Ensayo);
  }

  const vacio = !ensayo || ensayo.lineas.length === 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Ensayo
          </CardTitle>
          <CardDescription>
            Preguntale lo que le preguntaría un cliente y mirá qué contesta, con
            su conocimiento real. <strong>No sale nada</strong>: ni a WhatsApp,
            ni a la bandeja, ni a Resultados.
          </CardDescription>
        </div>
        {!vacio && (
          <Button variant="outline" size="sm" onClick={() => void reiniciar()}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Empezar de nuevo
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-lg border bg-secondary/30 p-3">
          {vacio ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Probá con un precio, un horario o una política que acabes de
              cargar. Es la forma de ver si el agente la dice bien antes de que
              se la diga a un cliente.
            </p>
          ) : (
            ensayo.lineas.map((l) => (
              <div
                key={l.id}
                className={l.de === "vos" ? "flex justify-start" : "flex justify-end"}
              >
                <div
                  className={
                    l.de === "vos"
                      ? "max-w-[80%] rounded-lg rounded-bl-sm bg-card px-3 py-2 text-sm shadow-sm"
                      : "max-w-[80%] rounded-lg rounded-br-sm bg-primary/10 px-3 py-2 text-sm"
                  }
                >
                  <p className="whitespace-pre-wrap">{l.texto}</p>
                </div>
              </div>
            ))
          )}
          {pensando && (
            <p className="px-1 text-xs text-muted-foreground">El agente está pensando…</p>
          )}
          <div ref={finRef} />
        </div>

        {ensayo?.escalado && (
          <p className="flex items-start gap-2 rounded-lg border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
            <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>El agente escaló a una persona</strong>
              {ensayo.escalado.motivo
                ? `: ${MOTIVO[ensayo.escalado.motivo] ?? ensayo.escalado.motivo}`
                : ""}
              . Desde acá no va a contestar más hasta que empieces de nuevo —
              que es exactamente lo que hace con un cliente de verdad.
            </span>
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            placeholder="Escribí como si fueras el cliente…"
            disabled={pensando}
          />
          <Button onClick={() => void enviar()} disabled={pensando || !texto.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
