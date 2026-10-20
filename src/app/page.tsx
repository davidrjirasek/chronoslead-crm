import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { guideFirst } from "@/server/onboarding/guide";
import { LandingPublica } from "@/components/landing/landing-publica";
import { InstanciaInexistente } from "@/components/instancia-inexistente";
import { currentTenantHost } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";

export const dynamic = "force-dynamic";

/**
 * 107 — Qué hay en la raíz depende del HOST, no de la ruta.
 *
 * `chronoslead.com` (y `www`) es la landing comercial; `{slug}.chronoslead.com`
 * es el CRM de ese cliente. Son dos cosas distintas en la misma aplicación, y
 * separarlas por ruta (`/` y `/app`) fue lo que hacía el repo anterior: obliga
 * a que cada enlace sepa en cuál de los dos mundos está.
 *
 * Sin `EDITION=cloud` no hay landing: una instancia de un solo negocio es solo
 * el CRM, igual que en upstream.
 *
 * Dentro del CRM (issue #86): mientras falte un paso de la guía de inicio o el
 * agente siga apagado, a `/onboarding`; con todo listo, a la Bandeja. Sin
 * sesión, `/inbox` manda al login.
 */
export default async function Home() {
  if (isCloud()) {
    const host = await currentTenantHost();
    if (host.kind === "landing") return <LandingPublica />;
    if (host.kind !== "tenant") return <InstanciaInexistente />;
  }
  const session = await getSessionOrNull();
  if (session && (await guideFirst(session))) redirect("/onboarding");
  redirect("/inbox");
}
