"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 151 — Ajustes → Consulta: enseñarle al agente a preguntarle algo al sistema
 * del propio negocio.
 *
 * La credencial se pega acá y no vuelve a verse: se guarda cifrada y de vuelta
 * solo llegan sus últimos 4. Y «Probar» manda una consulta de verdad y enseña
 * **la respuesta cruda** — es el «curl primero, código después» que pide el
 * brief de The Student Store, hecho sin que la llave pase por ningún chat.
 */

type Consulta = {
  name: string;
  criterio: string | null;
  datoPedido: string;
  url: string;
  method: "GET" | "POST";
  requestField: string;
  responseField: string;
  authHeader: string | null;
  tieneCredencial: boolean;
  ultimos4: string | null;
  active: boolean;
};

const VACIA: Consulta = {
  name: "",
  criterio: "",
  datoPedido: "",
  url: "",
  method: "POST",
  requestField: "",
  responseField: "",
  authHeader: "",
  tieneCredencial: false,
  ultimos4: null,
  active: true,
};

export function ConsultaClient() {
  const [c, setC] = useState<Consulta | null>(null);
  const [credencial, setCredencial] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dato, setDato] = useState("");
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{
    ok: boolean;
    valor: string | null;
    detalle: string | null;
    crudo: string | null;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings/consulta").catch(() => null);
      const data = (await res?.json().catch(() => null)) as {
        consulta?: Consulta | null;
      } | null;
      setC(data?.consulta ?? VACIA);
    })();
  }, []);

  async function guardar() {
    if (!c) return;
    setGuardando(true);
    setError(null);
    setAviso(null);
    const res = await fetch("/api/settings/consulta", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...c,
        criterio: c.criterio ?? null,
        authHeader: c.authHeader ?? null,
        // Vacío = no lo toqué. La credencial guardada no se pisa sin querer.
        authValue: credencial.trim() ? credencial.trim() : undefined,
      }),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(d?.error?.message ?? "No se pudo guardar");
      return;
    }
    const data = (await res.json()) as { consulta: Consulta };
    setC(data.consulta);
    setCredencial("");
    setAviso("Guardado.");
  }

  async function probar() {
    if (!dato.trim()) return;
    setProbando(true);
    setPrueba(null);
    const res = await fetch("/api/settings/consulta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dato: dato.trim() }),
    }).catch(() => null);
    setProbando(false);
    const data = (await res?.json().catch(() => null)) as {
      ok?: boolean;
      valor?: string | null;
      detalle?: string | null;
      crudo?: string | null;
    } | null;
    setPrueba({
      ok: Boolean(data?.ok),
      valor: data?.valor ?? null,
      detalle: data?.detalle ?? null,
      crudo: data?.crudo ?? null,
    });
  }

  if (!c) return <p className="text-sm text-text-3">Cargando…</p>;

  const set = (cambio: Partial<Consulta>) => setC({ ...c, ...cambio });

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preguntarle a tu sistema</CardTitle>
          <CardDescription>
            El agente puede consultar algo tuyo —un saldo, el estado de un
            pedido— y contestarlo con el dato real. Él solo captura lo que hace
            falta para preguntar: <strong>el valor sale de tu sistema, nunca
            del modelo</strong>, para que no pueda inventarlo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="c-name">Cómo se llama</Label>
              <Input
                id="c-name"
                value={c.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="el saldo del alumno"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-dato">Qué hay que pedirle al cliente</Label>
              <Input
                id="c-dato"
                value={c.datoPedido}
                onChange={(e) => set({ datoPedido: e.target.value })}
                placeholder="el número de cédula del alumno"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-criterio">Cuándo usarla</Label>
            <Input
              id="c-criterio"
              value={c.criterio ?? ""}
              onChange={(e) => set({ criterio: e.target.value })}
              placeholder="cuando un padre pregunta cuánto saldo le queda a su hijo"
            />
            <p className="text-[11px] text-text-3">
              Esto lo lee el agente para decidir cuándo consultar. Escribilo
              como se lo explicarías a alguien que recién entra.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-url">Dirección</Label>
            <Input
              id="c-url"
              value={c.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="c-method">Método</Label>
              <select
                id="c-method"
                value={c.method}
                onChange={(e) =>
                  set({ method: e.target.value as "GET" | "POST" })
                }
                className="h-9 w-full rounded-md border border-border bg-raised px-2 text-sm"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-req">Campo que se manda</Label>
              <Input
                id="c-req"
                value={c.requestField}
                onChange={(e) => set({ requestField: e.target.value })}
                placeholder="student_ci"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-res">Campo de la respuesta</Label>
              <Input
                id="c-res"
                value={c.responseField}
                onChange={(e) => set({ responseField: e.target.value })}
                placeholder="answer"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="c-header">Cabecera de autenticación</Label>
              <Input
                id="c-header"
                value={c.authHeader ?? ""}
                onChange={(e) => set({ authHeader: e.target.value })}
                placeholder="x-api-key"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-cred">
                Su valor
                {c.tieneCredencial && (
                  <span className="ml-1 font-normal text-text-3">
                    · guardado ••••{c.ultimos4}
                  </span>
                )}
              </Label>
              <Input
                id="c-cred"
                type="password"
                value={credencial}
                onChange={(e) => setCredencial(e.target.value)}
                placeholder={
                  c.tieneCredencial ? "dejalo vacío para no cambiarlo" : "pegá la llave"
                }
              />
              <p className="text-[11px] text-text-3">
                Se guarda cifrada en tu servidor y no vuelve a mostrarse.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Button type="button" onClick={() => void guardar()} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.active}
                onChange={(e) => set({ active: e.target.checked })}
              />
              Activa
            </label>
            {aviso && <span className="text-sm text-success-text">{aviso}</span>}
            {error && <span className="text-sm text-danger-text">{error}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Probar</CardTitle>
          <CardDescription>
            Manda una consulta de verdad y te enseña lo que contestó tu sistema,
            sin interpretarlo. Es la forma de confirmar que la llave y los
            campos están bien antes de encender al agente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="c-prueba">
                {c.datoPedido || "El dato a consultar"}
              </Label>
              <Input
                id="c-prueba"
                value={dato}
                onChange={(e) => setDato(e.target.value)}
                className="w-64"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void probar()}
              disabled={probando || !dato.trim()}
            >
              {probando ? "Consultando…" : "Probar"}
            </Button>
          </div>

          {prueba && (
            <div className="space-y-2">
              <p
                className={
                  prueba.ok
                    ? "text-sm font-medium text-success-text"
                    : "text-sm font-medium text-danger-text"
                }
              >
                {prueba.ok
                  ? `Contestó: ${prueba.valor}`
                  : `No se pudo: ${prueba.detalle}`}
              </p>
              {prueba.crudo && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-text-2">
                    Lo que devolvió, tal cual:
                  </p>
                  <pre className="max-h-48 overflow-auto rounded-md border border-line bg-subtle p-2 text-[11px] leading-relaxed">
                    {prueba.crudo}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
