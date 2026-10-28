import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 20);

const prefixes = {
  organization: "org",
  member: "mem",
  contact: "ct",
  conversation: "cv",
  message: "msg",
  lead: "ld",
  stage: "stg",
  leadStageEvent: "lse",
  credentials: "cred",
  agentProfile: "agp",
  accessLink: "alk",
  payment: "pay",
  kbEntry: "kb",
  template: "tpl",
  testRun: "run",
  testCase: "case",
  mediaAsset: "ma",
  // 015 — motor de agenda
  calendarSettings: "cal",
  booking: "bk",
  offeredSlot: "ofs",
  zoomCredentials: "zcred",
  googleCredentials: "gcred",
  // 016 — atribución de anuncios
  adAttribution: "att",
  conversionEvent: "cve",
  capiSettings: "capi",
  // Ajustes → IA (issue #85)
  aiCredentials: "aicred",
  aiUsage: "aiuse",
  // 021 — despacho al cerebro
  dispatch: "dsp",
  // 026 — el aviso de que una conversación se eliminó
  olvido: "olv",
  /**
   * 127 — El cuestionario de puesta en marcha que completa un cliente ANTES de
   * existir como organización. Se llama «cuestionario» y no «onboarding»
   * porque `onboarding` ya es la guía de inicio DENTRO del CRM
   * (`src/server/onboarding/guide.ts`): son dos cosas distintas y compartir el
   * nombre las confunde. El subdominio público sí es `onboarding.…`, que es
   * como lo llama el dueño de cara al cliente.
   */
  cuestionario: "cue",
  /** La llave que viaja en la URL. 20 caracteres de 36: no se adivina. */
  cuestionarioLlave: "cuek",
} as const;

export type IdKind = keyof typeof prefixes;

export function newId(kind: IdKind): string {
  return `${prefixes[kind]}_${nano()}`;
}
