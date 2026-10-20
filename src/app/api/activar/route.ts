import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { apiError, parseBody } from "@/lib/api";
import { getAuth } from "@/lib/auth";
import {
  consumirEnlace,
  MIN_LONGITUD_CONTRASENA,
} from "@/server/platform/access-link";
import { currentTenantOrg } from "@/server/tenant/current";
import { isCloud } from "@/server/tenant/edition";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * 106 — Fija la contraseña de un enlace de un solo uso y deja la sesión
 * iniciada, para que el cliente caiga directo en la guía de inicio.
 *
 * Es una superficie PÚBLICA: la protege el token, no una sesión. Por eso lleva
 * límite por IP, igual que el login.
 */
const esquema = z.object({
  token: z.string().min(1),
  contrasena: z.string().min(MIN_LONGITUD_CONTRASENA),
});

/** Mismo presupuesto que el login: probar tokens al azar no sale gratis. */
const LIMITE = { windowMs: 10 * 60_000, max: 10 };

export async function POST(req: Request) {
  if (!isCloud()) return new Response(null, { status: 404 });

  const ip = clientIp(req.headers);
  if (!checkRateLimit(`activar:${ip}`, LIMITE).allowed) {
    return apiError(429, "rate_limited", "Demasiados intentos; espera unos minutos");
  }

  const org = await currentTenantOrg();
  if (!org) return new Response(null, { status: 404 });

  const body = await parseBody(req, esquema);
  if (!body.ok) {
    // Un cuerpo que no valida casi siempre es la contraseña corta; se devuelve
    // el código que la pantalla sabe traducir.
    return apiError(
      422,
      "contrasena_corta",
      `La contraseña debe tener al menos ${MIN_LONGITUD_CONTRASENA} caracteres`
    );
  }

  const resultado = await consumirEnlace(
    body.data.token,
    org.id,
    body.data.contrasena
  );
  if (!resultado.ok) {
    return apiError(
      resultado.codigo === "contrasena_corta" ? 422 : 400,
      resultado.codigo,
      resultado.codigo === "contrasena_corta"
        ? `La contraseña debe tener al menos ${MIN_LONGITUD_CONTRASENA} caracteres`
        : "Este enlace ya no sirve"
    );
  }

  const correo = await db_correoDe(resultado.userId);
  if (!correo) return apiError(400, "enlace_invalido", "Este enlace ya no sirve");

  // Deja la sesión iniciada: el cliente acaba de demostrar que controla el
  // enlace y acaba de elegir la contraseña, así que pedírsela otra vez solo
  // añade un paso donde se puede equivocar.
  const respuesta = await getAuth().api.signInEmail({
    body: { email: correo, password: body.data.contrasena },
    headers: req.headers,
    asResponse: true,
  });
  return respuesta;
}

async function db_correoDe(userId: string): Promise<string | null> {
  const filas = await getDb()
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  return filas[0]?.email ?? null;
}
