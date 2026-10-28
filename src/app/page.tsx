import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { guideFirst } from "@/server/onboarding/guide";
import { LandingPublica } from "@/components/landing/landing-publica";
import { InstanciaInexistente } from "@/components/instancia-inexistente";
import { Formulario } from "@/components/cuestionario/formulario";
import { leerPorLlave } from "@/server/cuestionario/store";
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
 * 127 — `onboarding.*` es el cuestionario de puesta en marcha: público, sin
 * sesión, y de un cliente que TODAVÍA NO EXISTE. Entra como una rama más de
 * esta misma decisión por Host en vez de una ruta `/onboarding` —que además ya
 * está ocupada por la guía de inicio dentro del CRM—.
 *
 * Dentro del CRM (issue #86): mientras falte un paso de la guía de inicio o el
 * agente siga apagado, a `/onboarding`; con todo listo, a la Bandeja. Sin
 * sesión, `/inbox` manda al login.
 */
export default async function Home({
  searchParams,
}: {
  // `searchParams` es opcional, pero el OBJETO de props no puede serlo: Next
  // genera un tipo que no acepta `undefined` ahí. Las pruebas pasan `{}`.
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isCloud()) {
    const host = await currentTenantHost();
    if (host.kind === "landing") return <LandingPublica />;
    if (host.kind === "onboarding") {
      // La llave de la URL ES la credencial (spec 127): sin ella se empieza
      // uno nuevo; con una que no existe, también — así no se le confirma a
      // nadie qué llaves son válidas.
      const k = searchParams ? (await searchParams).k : undefined;
      const llave = typeof k === "string" ? k : "";
      const guardado = llave ? await leerPorLlave(llave) : null;
      return (
        <Formulario
          inicial={
            guardado
              ? {
                  llave: guardado.llave,
                  cliente: guardado.cliente,
                  contacto: guardado.contacto,
                  correo: guardado.correo,
                  seccionActual: guardado.seccionActual,
                  respuestas: guardado.respuestas,
                  enviado: guardado.enviadoAt !== null,
                }
              : null
          }
        />
      );
    }
    // 108 — En `admin.*` la raíz ES el panel. Sin esto, entrar funcionaba y el
    // login dejaba al operador en «esta instancia no existe», porque la raíz
    // buscaba una organización que ese Host no tiene.
    if (host.kind === "admin") redirect("/admin");
    if (host.kind !== "tenant") return <InstanciaInexistente />;
  }
  const session = await getSessionOrNull();
  if (session && (await guideFirst(session))) redirect("/onboarding");
  redirect("/inbox");
}
