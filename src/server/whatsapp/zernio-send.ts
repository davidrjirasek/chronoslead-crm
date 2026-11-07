import type { ZernioWhatsapp } from "@/server/whatsapp/credentials";
import { sendZernioMessage } from "@/server/zernio";

/**
 * 139 — Frontera de salida de WhatsApp cuando el transporte es Zernio
 * (Constitución II: todo request a una plataforma pasa por un único módulo).
 *
 * El transporte nativo arma un payload de la Graph API y lo manda a
 * `/{phone_number_id}/messages` con el `to` del cliente. Zernio es
 * conversation-centric: se responde DENTRO de la conversación, con el
 * `conversationId` opaco que guardó la ingesta y que viaja en `threadRef`.
 *
 * La ventana de 24 h y el límite de longitud se comprueban antes, en
 * `prepareSend` (`src/server/inbox/send.ts`): aquí ya solo se envía.
 */

export type ZernioWhatsappSendResult = { platformMessageId: string };

export async function sendZernioWhatsappText(input: {
  credentials: ZernioWhatsapp;
  threadRef: string | null;
  text: string;
}): Promise<ZernioWhatsappSendResult> {
  return sendZernioMessage({
    token: input.credentials.token,
    accountId: input.credentials.accountRef,
    conversationId: input.threadRef,
    text: input.text,
  });
}
