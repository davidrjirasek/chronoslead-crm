import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  desconectarCanal,
  getCredentialsByOrg,
  getZernioWhatsappByOrg,
  saveCredentials,
  saveZernioWhatsappCredentials,
  tokenLast4,
} from "@/server/whatsapp/credentials";
import { ensureWebhookForOrg } from "@/server/zernio/conexiones";
import { accountHealth, zernioAccountName } from "@/server/zernio/cuentas";
import { resolveZernioAccount } from "@/server/zernio/guardar";
import {
  registerWebhookForNumber,
  testConnection,
  unregisterWebhookForNumber,
} from "@/server/whatsapp/connect";
import {
  webhookDeSesion,
} from "@/server/whatsapp/webhook-url";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const creds = await getCredentialsByOrg(session.organizationId);
  // 139 — Sin esto, una organización conectada por Zernio ve «sin conectar»
  // en Ajustes teniendo el número andando, y lo natural es que alguien lo
  // «arregle» conectándolo otra vez por el camino que no le toca.
  if (!creds) {
    const porZernio = await getZernioWhatsappByOrg(session.organizationId);
    if (porZernio) {
      return Response.json({
        connection: {
          source: "zernio",
          accountRef: porZernio.accountRef,
          displayPhoneNumber: porZernio.displayPhoneNumber,
          verifiedName: porZernio.verifiedName,
          status: porZernio.status,
          tokenLast4: tokenLast4(porZernio.token),
          hasWebhookSecret: Boolean(porZernio.webhookSecret),
        },
      });
    }
    return Response.json({ connection: null });
  }
  return Response.json({
    connection: {
      source: "meta",
      wabaId: creds.wabaId,
      phoneNumberId: creds.phoneNumberId,
      displayPhoneNumber: creds.displayPhoneNumber,
      verifiedName: creds.verifiedName,
      status: creds.status,
      tokenLast4: tokenLast4(creds.token),
    },
  });
});

const putSchema = z.object({
  /**
   * 139 — Qué transporte. Por omisión `meta`: el asistente manual que ya
   * existe no manda este campo y tiene que seguir funcionando igual.
   */
  source: z.enum(["zernio", "meta"]).default("meta"),
  /** Con Meta, obligatorios. Con Zernio no existen. */
  wabaId: z.string().trim().min(1).nullish(),
  phoneNumberId: z.string().trim().min(1).nullish(),
  /** Con Zernio: opcional si la llave tiene una sola cuenta de WhatsApp. */
  accountRef: z.string().trim().min(1).nullish(),
  webhookSecret: z.string().trim().min(1).nullish(),
  token: z.string().trim().min(1),
});

/**
 * Guarda la conexión: re-valida contra Meta, cifra (FR-040) y registra el
 * webhook de esta instancia en el número.
 *
 * Antes el CRM solo suscribía la app a la WABA y la URL había que pegarla a
 * mano en el panel de Meta. Si Meta rechaza el registro, la conexión YA está
 * guardada y es válida: se avisa en `webhook` y la tarjeta del webhook ofrece
 * reintentar (o pegar la URL a mano, que sigue a la vista).
 */
export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  /**
   * 139 — WhatsApp por Zernio: el camino para un número que tiene que seguir
   * viviendo en la app WhatsApp Business del teléfono (Coexistencia). No se
   * valida contra la Graph API porque no hay token de Meta que validar: se
   * resuelve la cuenta contra Zernio, que es quien la tiene.
   */
  if (body.data.source === "zernio") {
    const cuenta = await resolveZernioAccount(
      body.data.token,
      body.data.accountRef,
      "whatsapp"
    );
    if (!cuenta.ok) return cuenta.response;

    const previa = await getZernioWhatsappByOrg(session.organizationId);
    const numero = cuenta.account.username?.trim() || null;
    await saveZernioWhatsappCredentials({
      organizationId: session.organizationId,
      accountRef: cuenta.account._id,
      token: body.data.token,
      displayPhoneNumber: numero,
      verifiedName: cuenta.account.displayName?.trim() || null,
      // Sin secreto nuevo se conserva el que había: reconectar no debe apagar
      // la verificación de firma.
      webhookSecret: body.data.webhookSecret ?? previa?.webhookSecret ?? null,
    });

    // Zernio entrega por UN webhook por llave: esto lo da de alta o comprueba
    // que ya apunte aquí, y guarda su secreto cifrado.
    const webhook = await ensureWebhookForOrg(session.organizationId, {
      secret: body.data.webhookSecret,
    });

    return Response.json({
      ok: true,
      displayPhoneNumber: numero,
      accountRef: cuenta.account._id,
      accountName: zernioAccountName(cuenta.account),
      health: accountHealth(cuenta.account, "whatsapp"),
      webhook,
    });
  }

  if (!body.data.wabaId || !body.data.phoneNumberId) {
    return apiError(
      422,
      "invalid_body",
      "Con la Cloud API directa hacen falta el identificador de la cuenta y el del número"
    );
  }
  const check = await testConnection(body.data.phoneNumberId, body.data.token);
  if (!check.ok) {
    const status = check.code === "meta_unavailable" ? 503 : 422;
    return apiError(status, check.code, check.message);
  }

  await saveCredentials({
    organizationId: session.organizationId,
    wabaId: body.data.wabaId,
    phoneNumberId: body.data.phoneNumberId,
    token: body.data.token,
    displayPhoneNumber: check.displayPhoneNumber,
    verifiedName: check.verifiedName,
  });

  const webhook102 = await webhookDeSesion(session.organizationId, "wa");
  const webhook = await registerWebhookForNumber({
    wabaId: body.data.wabaId,
    phoneNumberId: body.data.phoneNumberId,
    token: body.data.token,
    webhookUrl: webhook102.url,
    verifyToken: webhook102.verifyToken,
  });

  return Response.json({
    ok: true,
    displayPhoneNumber: check.displayPhoneNumber,
    webhook,
  });
});

/**
 * Desconectar el número. Sin esto, conectar era una calle de un solo
 * sentido: la unicidad del número impedía moverlo a otra instancia y no había
 * pantalla donde soltarlo.
 *
 * Primero quita el override del webhook que puso el guardado —con el token
 * todavía a mano; sin él no se podría— y después borra las credenciales. No
 * borra la bandeja: las conversaciones son de la organización, no de la
 * conexión. Idempotente: sin conexión responde 200 igual.
 */
export const DELETE = withAuth(async (session) => {
  const creds = await getCredentialsByOrg(session.organizationId);
  // 139 — Una fila de Zernio no tiene override de webhook en Meta que quitar
  // (su webhook es de la llave, compartido, y lo administra Zernio): se borra
  // y nada más. `getCredentialsByOrg` ya devuelve null para ella.
  if (creds) {
    await unregisterWebhookForNumber({
      phoneNumberId: creds.phoneNumberId,
      token: creds.token,
      webhookPath: (await webhookDeSesion(session.organizationId, "wa")).path,
    });
  }
  await desconectarCanal(session.organizationId);
  return Response.json({ ok: true });
});
