"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Link2, Trash2, UserPlus } from "lucide-react";
import { ContactAvatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { puedeActuarSobre, puedeAsignarRol } from "@/lib/auth/rangos";

type Member = {
  id: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
};

type Movimiento = {
  id: string;
  actor: string;
  accion: string;
  objetivo: string;
  detalle: string | null;
  cuando: string;
};

const ETIQUETA_ROL: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};

const ETIQUETA_ACCION: Record<string, string> = {
  alta: "creó la cuenta de",
  agregado: "agregó al equipo a",
  baja: "quitó del equipo a",
  rol: "cambió el rol de",
  enlace: "generó un enlace de acceso para",
};

export function TeamClient({
  cloud = false,
  rolActual = "owner",
}: {
  /** 136 — Sin EDITION=cloud el panel es el de upstream: solo listar y crear. */
  cloud?: boolean;
  rolActual?: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"member" | "admin">("member");
  const [tempPassword, setTempPassword] = useState("");
  const [created, setCreated] = useState<
    { email: string; password: string | null } | null
  >(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enlace, setEnlace] = useState<{ email: string; url: string } | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [bitacoraAbierta, setBitacoraAbierta] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/settings/team").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { members: Member[] };
    setMembers(data.members);
  }, []);

  const refetchBitacora = useCallback(async () => {
    if (!cloud) return;
    const res = await fetch("/api/settings/team/bitacora").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { movimientos: Movimiento[] };
    setMovimientos(data.movimientos);
  }, [cloud]);

  useEffect(() => {
    void refetch();
    void refetchBitacora();
  }, [refetch, refetchBitacora]);

  /**
   * 136 — Avisar antes de perder una contraseña que no se copió.
   *
   * No existe «olvidé mi contraseña» en todo el producto —la constitución
   * prohíbe el correo transaccional—, así que una contraseña temporal que se
   * cierra sin copiar deja a esa persona sin forma de entrar hasta que alguien
   * con rango le genere un enlace. El aviso cuesta tres líneas.
   */
  useEffect(() => {
    if (!created?.password || copiado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [created, copiado]);

  function generatePassword() {
    const alphabet =
      "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    setTempPassword(
      Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
    );
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  async function leerError(res: Response | null): Promise<string> {
    const data = (await res?.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return data?.error?.message ?? "No se pudo completar la acción";
  }

  async function create() {
    setSaving(true);
    setError(null);
    setCreated(null);
    setCopiado(false);
    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password: tempPassword, rol }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setError(await leerError(res));
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      creada?: boolean;
    } | null;
    /**
     * 136 — Alta unificada: si la persona YA tenía cuenta, no hay contraseña
     * nueva que mostrar. Entra con la que usa en su otra organización.
     */
    const creada = data?.creada ?? true;
    setCreated({ email, password: creada ? tempPassword : null });
    setName("");
    setEmail("");
    setTempPassword("");
    void refetch();
    void refetchBitacora();
  }

  async function quitar(m: Member) {
    const seguro = window.confirm(
      `¿Quitar a ${m.email} del equipo?\n\n` +
        "Pierde el acceso en el acto. Sus conversaciones y su historial quedan " +
        "intactos, y si trabaja en otra empresa tuya sigue entrando ahí."
    );
    if (!seguro) return;
    setOcupado(m.id);
    setError(null);
    const res = await fetch(`/api/settings/team/${m.id}`, {
      method: "DELETE",
    }).catch(() => null);
    setOcupado(null);
    if (!res?.ok) {
      setError(await leerError(res));
      return;
    }
    void refetch();
    void refetchBitacora();
  }

  async function cambiarRolDe(m: Member, nuevo: string) {
    setOcupado(m.id);
    setError(null);
    const res = await fetch(`/api/settings/team/${m.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rol: nuevo }),
    }).catch(() => null);
    setOcupado(null);
    if (!res?.ok) {
      setError(await leerError(res));
      return;
    }
    void refetch();
    void refetchBitacora();
  }

  async function generarEnlace(m: Member) {
    setOcupado(m.id);
    setError(null);
    setEnlace(null);
    const res = await fetch(`/api/settings/team/${m.id}/enlace`, {
      method: "POST",
    }).catch(() => null);
    setOcupado(null);
    if (!res?.ok) {
      setError(await leerError(res));
      return;
    }
    const data = (await res.json()) as { url: string; email: string };
    setEnlace({ url: data.url, email: data.email });
    void refetchBitacora();
  }

  const rolesOfrecidos = (["member", "admin"] as const).filter((r) =>
    cloud ? puedeAsignarRol(rolActual, r) : true
  );

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear cuenta de equipo</CardTitle>
          <CardDescription>
            Sin correos ni invitaciones: comparte tú mismo la contraseña
            temporal con tu compañero (se muestra UNA sola vez).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Nombre</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-email">Correo</Label>
              <Input
                id="team-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-rol">Qué va a poder hacer</Label>
            <select
              id="team-rol"
              value={rol}
              onChange={(e) => setRol(e.target.value as "member" | "admin")}
              className="h-9 w-full rounded-md border border-line bg-transparent px-3 text-sm"
            >
              {rolesOfrecidos.map((r) => (
                <option key={r} value={r}>
                  {r === "member"
                    ? "Atender la Bandeja"
                    : "Atender y configurar — administrador"}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-snug text-text-3">
              Un administrador puede cambiar el agente, las llaves y los
              canales. Dáselo solo a quien tenga que configurar.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-password">Contraseña temporal</Label>
            <div className="flex gap-2">
              <Input
                id="team-password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
              />
              <Button variant="outline" onClick={generatePassword}>
                Generar
              </Button>
            </div>
            {cloud && (
              <p className="text-[11px] leading-snug text-text-3">
                Si el correo ya tiene cuenta en ChronosLead, la contraseña se
                ignora: esa persona entra con la que ya usa.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {created && (
            <div className="rounded-md border border-success-soft bg-success-tint p-3 text-sm">
              <p className="font-medium text-success-text">
                {created.password ? "Cuenta creada ✓" : "Agregado al equipo ✓"}
              </p>
              {created.password ? (
                <>
                  <p className="mt-1 text-success-text opacity-90">
                    Compartí estos datos ahora. <strong>No hay forma de
                    recuperar esta contraseña</strong> — si la perdés, hay que
                    generarle un enlace de acceso.
                  </p>
                  <p className="mt-2 text-success-text">
                    <code>{created.email}</code> · contraseña{" "}
                    <code>{created.password}</code>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                      void copiar(
                        `${created.email} · contraseña ${created.password}`
                      )
                    }
                  >
                    {copiado ? (
                      <Check className="mr-1.5 h-4 w-4" />
                    ) : (
                      <Copy className="mr-1.5 h-4 w-4" />
                    )}
                    {copiado ? "Copiado" : "Copiar"}
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-success-text opacity-90">
                  <code>{created.email}</code> ya tenía cuenta en ChronosLead:
                  entra acá con la contraseña que usa siempre. No hace falta
                  una nueva.
                </p>
              )}
            </div>
          )}
          <Button
            disabled={
              saving || !name.trim() || !email.trim() || tempPassword.length < 8
            }
            onClick={() => void create()}
          >
            <UserPlus className="h-4 w-4" />
            {saving ? "Creando…" : "Crear cuenta"}
          </Button>
        </CardContent>
      </Card>

      {enlace && (
        <div className="rounded-md border border-success-soft bg-success-tint p-3 text-sm">
          <p className="font-medium text-success-text">
            Enlace para {enlace.email}
          </p>
          <p className="mt-1 text-success-text opacity-90">
            Sirve una vez y caduca a los 7 días. Invalidó el enlace anterior de
            esa persona, si tenía uno.
          </p>
          <p className="mt-2 break-all text-success-text">
            <code>{enlace.url}</code>
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void copiar(enlace.url)}
          >
            <Copy className="mr-1.5 h-4 w-4" />
            Copiar enlace
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Miembros
        </p>
        {members.map((m) => {
          /**
           * 136 — Las acciones solo se DIBUJAN sobre rangos menores. Eso es
           * cortesía, no protección: el pedido se puede repetir a mano. Quien
           * de verdad lo impide es la ruta.
           */
          const gobernable = cloud && puedeActuarSobre(rolActual, m.role);
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <ContactAvatar name={m.name} seed={m.id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              {gobernable ? (
                <select
                  value={m.role}
                  disabled={ocupado === m.id}
                  aria-label={`Rol de ${m.email}`}
                  onChange={(e) => void cambiarRolDe(m, e.target.value)}
                  className="h-8 rounded-md border border-line bg-transparent px-2 text-xs"
                >
                  {(["member", "admin"] as const)
                    .filter((r) => puedeAsignarRol(rolActual, r))
                    .map((r) => (
                      <option key={r} value={r}>
                        {ETIQUETA_ROL[r]}
                      </option>
                    ))}
                </select>
              ) : (
                <Badge variant={m.role === "member" ? "secondary" : "default"}>
                  {ETIQUETA_ROL[m.role] ?? m.role}
                </Badge>
              )}
              {gobernable && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado === m.id}
                    title="Generar un enlace para que elija contraseña nueva"
                    onClick={() => void generarEnlace(m)}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado === m.id}
                    title="Quitar del equipo"
                    onClick={() => void quitar(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cloud && movimientos.length > 0 && (
        /**
         * 136 — Plegado por defecto.
         *
         * Es un historial que solo crece: desplegado empuja la lista de
         * miembros fuera de la pantalla y vuelve ruido lo que casi siempre se
         * mira de reojo. Se abre cuando hace falta, que es cuando pasó algo
         * raro.
         */
        <div className="rounded-lg border bg-card">
          <button
            type="button"
            onClick={() => setBitacoraAbierta((v) => !v)}
            aria-expanded={bitacoraAbierta}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                bitacoraAbierta ? "rotate-180" : ""
              }`}
            />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Movimientos del equipo
            </span>
            <span className="text-xs text-muted-foreground">
              ({movimientos.length})
            </span>
          </button>
          {bitacoraAbierta && (
            <div className="border-t">
              <p className="px-4 py-2 text-[11px] leading-snug text-text-3">
                Queda registrado quién hizo qué. ChronosLead no manda correos,
                así que esta es la forma de enterarte de un cambio que no
                hiciste vos.
              </p>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto border-t">
                {movimientos.map((mv) => (
                  <li key={mv.id} className="px-4 py-2 text-xs">
                    <span className="font-medium">{mv.actor}</span>{" "}
                    {ETIQUETA_ACCION[mv.accion] ?? mv.accion}{" "}
                    <span className="font-medium">{mv.objetivo}</span>
                    {mv.detalle ? (
                      <span className="text-muted-foreground"> · {mv.detalle}</span>
                    ) : null}
                    <span className="block text-muted-foreground">
                      {new Date(mv.cuando).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
