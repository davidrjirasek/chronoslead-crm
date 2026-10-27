import { mockGuard } from "@/lib/dev-guard";
import {
  aiMockAuthFailure,
  aiMockCompletion,
  aiMockEstado,
  aiMockRegistrar,
} from "@/server/dev/ai-mock";

export const dynamic = "force-dynamic";

/** 025 — Consultar o configurar el mock (demora y peticiones recibidas). */
export async function GET(req: Request) {
  const guard = mockGuard();
  if (guard) return guard;
  const e = aiMockEstado(new URL(req.url).searchParams);
  return Response.json({ demoraMs: e.demoraMs, peticiones: e.peticiones });
}

export async function POST(req: Request) {
  const guard = mockGuard();
  if (guard) return guard;

  // Como el wa-mock con su sufijo `-invalid`: una llave con sufijo conocido
  // se rechaza con el código que daría el proveedor, para ejercitar la pausa.
  const rechazo = aiMockAuthFailure(req.headers.get("authorization"));
  if (rechazo) return Response.json(rechazo.body, { status: rechazo.status });

  const body = (await req.json().catch(() => ({}))) as {
    messages?: { role: string; content: string }[];
  };
  await aiMockRegistrar(body.messages ?? []);
  const content = aiMockCompletion(body.messages ?? []);
  /**
   * 122 — El simulador también manda `usage`, como los proveedores reales.
   *
   * Sin esto, el camino que anota el consumo no se ejercita nunca en pruebas:
   * quedaría comprobado que compila y sin comprobar que escribe. Los números
   * se derivan del tamaño real del pedido y la respuesta — no son fijos, para
   * que un cambio que deje de mandar el historial se note.
   */
  const pedido = (body.messages ?? []).reduce(
    (n, m) => n + Math.ceil((m.content?.length ?? 0) / 4),
    0
  );
  const salida = Math.ceil(content.length / 4);
  return Response.json({
    id: "aimock",
    choices: [{ index: 0, message: { role: "assistant", content } }],
    usage: {
      prompt_tokens: pedido,
      completion_tokens: salida,
      total_tokens: pedido + salida,
    },
  });
}
