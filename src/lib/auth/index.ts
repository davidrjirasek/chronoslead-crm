import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AUTH_RATE_LIMIT, checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  onUserCreated,
  resolveActiveOrganizationId,
} from "@/server/auth/on-signup";
import { isPublicSignupAllowed } from "@/server/auth/registration";
import { baseDomain, isCloud } from "@/server/tenant/edition";

/**
 * Contexto interno del proceso: permite que el alta de cuentas de equipo
 * (owner → API) atraviese el gate de registro cerrado. No es alcanzable
 * desde fuera: solo envuelve llamadas server-side.
 */
const globalForSignup = globalThis as unknown as {
  __voceroInternalSignup?: AsyncLocalStorage<boolean>;
};

// En globalThis: los módulos pueden evaluarse más de una vez (una por ruta en
// dev) y todas las copias deben compartir el mismo contexto.
function internalSignupContext(): AsyncLocalStorage<boolean> {
  if (!globalForSignup.__voceroInternalSignup) {
    globalForSignup.__voceroInternalSignup = new AsyncLocalStorage<boolean>();
  }
  return globalForSignup.__voceroInternalSignup;
}

export function runInternalSignup<T>(fn: () => Promise<T>): Promise<T> {
  return internalSignupContext().run(true, fn);
}

function isInternalSignup(): boolean {
  return internalSignupContext().getStore() === true;
}

const RATE_LIMITED_PATHS = new Set(["/sign-in/email", "/sign-up/email"]);

/**
 * 101 — Orígenes de confianza con un subdominio por organización.
 *
 * Sin esto el CSRF de Better Auth rechaza TODOS los logins: el `Origin` de
 * `https://cliente.chronoslead.com` nunca coincide con el `baseURL`, y el CRM
 * se ve pero nadie entra.
 *
 * El apex va aparte (`*.dominio` no cubre `dominio`) y el puerto va aparte (el
 * navegador manda `http://demo.lvh.me:3000` y `http://*.lvh.me` no lo cubre).
 * Este fallo no lo encuentra un test unitario: lo encuentra un login real.
 */
export function buildTrustedOrigins(
  base: string,
  port?: string | null
): string[] {
  if (!base) return [];
  const sufijos = port ? ["", `:${port}`] : [""];
  const out: string[] = [];
  for (const s of sufijos) {
    out.push(`https://${base}${s}`, `https://*.${base}${s}`);
    out.push(`http://${base}${s}`, `http://*.${base}${s}`);
  }
  return out;
}

/** El puerto de `APP_BASE_URL`, cuando lo lleva explícito (desarrollo local). */
function puertoDeBaseUrl(appBaseUrl: string): string | null {
  try {
    return new URL(appBaseUrl).port || null;
  } catch {
    return null;
  }
}

function createAuth() {
  const env = getEnv();
  const cloud = isCloud();
  return betterAuth({
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    ...(cloud
      ? {
          trustedOrigins: buildTrustedOrigins(
            baseDomain(),
            puertoDeBaseUrl(env.APP_BASE_URL)
          ),
        }
      : {}),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        organization: schema.organization,
        member: schema.member,
        invitation: schema.invitation,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    // 101 — En plataforma, el plugin NO puede dejar crear organizaciones a
    // cualquier usuario autenticado: sería un alta sin pasar por el operador.
    plugins: [
      organization({
        creatorRole: "owner",
        ...(cloud ? { allowUserToCreateOrganization: false } : {}),
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Rate limit por IP en login/registro (FR-062): 10 / 10 min → 429.
        if (RATE_LIMITED_PATHS.has(ctx.path)) {
          const ip = clientIp(ctx.headers);
          const result = checkRateLimit(`${ctx.path}:${ip}`, AUTH_RATE_LIMIT);
          if (!result.allowed) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Demasiados intentos; espera unos minutos",
            });
          }
        }
        // Registro público cerrado tras la primera organización (FR-060).
        if (ctx.path === "/sign-up/email") {
          if (!isInternalSignup() && !(await isPublicSignupAllowed())) {
            throw new APIError("FORBIDDEN", {
              message: cloud
                ? "El registro no está abierto: las cuentas las crea el operador"
                : "El registro está cerrado: esta instancia ya tiene su organización",
            });
          }
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await onUserCreated(user.id, user.name);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const organizationId = await resolveActiveOrganizationId(
              session.userId
            );
            return {
              data: { ...session, activeOrganizationId: organizationId },
            };
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __voceroAuth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.__voceroAuth) globalForAuth.__voceroAuth = createAuth();
  return globalForAuth.__voceroAuth;
}
