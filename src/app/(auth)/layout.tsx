import { isVoceroName } from "@/lib/brand";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { getBranding } from "@/server/branding";
import { enabledChannels } from "@/server/channels/enabled";
import { productName } from "@/lib/channels";
import { BrandLogo } from "@/components/brand-mark";
import { InstanciaInexistente } from "@/components/instancia-inexistente";
import { EdicionProvider } from "@/components/auth/edicion";
import { EscenografiaChronosLead } from "@/components/auth/escenografia-chronoslead";
import { isChronosLeadName } from "@/lib/brand-chronoslead";
import { currentTenantHost, currentTenantOrg } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";

/**
 * Pantalla de entrada con la escenografía del hero de vocerocrm.com: papel
 * frío, rejilla difuminada y dos resplandores (azul y cian) detrás del
 * formulario. Con la marca Vocero se remata con el titular de la landing; una
 * instancia white-label ve su nombre y una descripción neutra.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 101 — En plataforma, un Host que no es de nadie no enseña un formulario de
  // acceso: no hay a qué entrar, y pintarlo con la marca por defecto invitaría
  // a probar contraseñas contra una organización que no existe.
  //
  // 108 — `admin` es la excepción: es una puerta de la plataforma, no de una
  // organización, así que no tiene ninguna y su login sí debe pintarse.
  if (isCloud()) {
    const host = await currentTenantHost();
    const esPuertaDeLaPlataforma = host.kind === "admin" || host.kind === "alta";
    if (!esPuertaDeLaPlataforma && !(await currentTenantOrg())) {
      return <InstanciaInexistente />;
    }
  }
  const branding = await getBranding().catch(() => DEFAULT_BRANDING);

  // 107 — La organización que no cambió su marca ve la escenografía de
  // ChronosLead: dos columnas, con el logo, el slogan y la imagen del equipo.
  // Es el porte de la pantalla que el dueño ya tenía, no un diseño nuevo.
  // Una organización white-label conserva la de Vocero, sobria y neutra: no
  // tiene por qué ver la marca de la plataforma al entrar a su propio CRM.
  if (isChronosLeadName(branding.name)) {
    return (
      <EscenografiaChronosLead>
        <EdicionProvider cloud={isCloud()}>{children}</EdicionProvider>
      </EscenografiaChronosLead>
    );
  }

  const vocero = isVoceroName(branding.name);
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-subtle p-4">
      <div className="brand-grid absolute inset-0" aria-hidden />
      <div className="brand-glow brand-glow-a" aria-hidden />
      <div className="brand-glow brand-glow-b" aria-hidden />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLogo branding={branding} size="lg" />
          {vocero ? (
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.03em]">
              El CRM{" "}
              <span
                className="bg-clip-text font-serif text-[1.18em] font-normal italic tracking-[-0.01em] text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(92deg, var(--accent) 12%, #00b4f0 88%)",
                }}
              >
                que es tuyo.
              </span>
            </h1>
          ) : (
            <div>
              <h1 className="sr-only">{branding.name}</h1>
              <p className="text-sm text-text-3">
                {productName([...enabledChannels()])} con agente de IA
              </p>
            </div>
          )}
        </div>
        <EdicionProvider cloud={isCloud()}>{children}</EdicionProvider>
      </div>
    </main>
  );
}
