/**
 * 101 — Lo que ve un Host que no es de ninguna organización.
 *
 * No dice qué organizaciones existen ni sugiere ninguna: un subdominio
 * inventado no puede servir para enumerar clientes.
 */
export function InstanciaInexistente() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-subtle p-4">
      <div className="brand-grid absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-sm text-center">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.03em]">
          Esta instancia no existe
        </h1>
        <p className="mt-3 text-sm text-text-3">
          La dirección que abriste no corresponde a ninguna cuenta. Revisa el
          enlace que te compartieron.
        </p>
      </div>
    </main>
  );
}
