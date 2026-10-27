import { getAuth } from "@/lib/auth";
import { rutaDeOrganizacion } from "@/lib/auth/superficie";

export const dynamic = "force-dynamic";

/**
 * 121 — El plugin de organización trae su propia API, y aquí NO se sirve.
 *
 * Esas rutas (`/api/auth/organization/*`) resuelven sobre
 * `session.activeOrganizationId`, que se fija al iniciar sesión como «la
 * primera membresía del usuario» y **no mira el Host**. Con un usuario en una
 * sola organización da igual; con el administrador de soporte en varias
 * —justo el modelo que habilita 121— apuntan al cliente equivocado.
 *
 * Comprobado en vivo el 27-oct-2026: con sesión abierta en el subdominio de
 * `prueba-b`, `get-full-organization` devolvió los datos de `prueba-a` y
 * `remove-member` **borró un miembro de `prueba-a`**.
 *
 * La aplicación no llama a ninguna de esas rutas: gestiona el equipo por
 * `/api/settings/team`, que resuelve la organización por el Host. Así que la
 * superficie se cierra entera en vez de intentar remendarla — una puerta que
 * nadie usa y que ignora el Host no se arregla, se tapia.
 */
function fueraDeServicio(): Response {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: Request) {
  if (rutaDeOrganizacion(req.url)) return fueraDeServicio();
  return getAuth().handler(req);
}

export async function POST(req: Request) {
  if (rutaDeOrganizacion(req.url)) return fueraDeServicio();
  return getAuth().handler(req);
}
