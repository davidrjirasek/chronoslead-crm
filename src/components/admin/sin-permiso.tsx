/**
 * 108 — Lo que ve alguien con sesión válida que no es superadmin.
 *
 * Dice el correo con el que entró a propósito: el caso real no es un intruso
 * —que no tendría sesión— sino el propio operador con la cuenta equivocada.
 * Sin ese dato se queda mirando un «no autorizado» sin saber por qué.
 */
export function SinPermiso({ correo }: { correo: string }) {
  return (
    <main className="cl-marca flex min-h-screen items-center justify-center p-6">
      <div className="cl-superficie max-w-md rounded-xl border border-line p-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/isotipo.png"
          alt=""
          aria-hidden
          className="mx-auto mb-4 h-11 w-11 object-contain"
        />
        <h1 className="text-xl font-bold tracking-tight">No tenés acceso a este panel</h1>
        <p className="mt-3 text-sm text-text-3">
          Entraste como <span className="font-mono">{correo}</span>, y ese correo no
          está en la lista de administradores de la plataforma.
        </p>
        <p className="mt-3 text-sm text-text-3">
          La lista se cambia en el servidor, en la variable{" "}
          <span className="font-mono">PLATFORM_SUPERADMIN_EMAILS</span>, y requiere
          volver a desplegar.
        </p>
      </div>
    </main>
  );
}
