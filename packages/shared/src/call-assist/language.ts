export type CallAssistLanguage = "en" | "es" | "und";

const SPANISH_CUES =
  /\b(hola|buenos d[ií]as|buenas tardes|por favor|emergencia|auxilio|ay[uú]dame|calle|carro|veh[ií]culo|polic[ií]a)\b/i;

/** Heuristic language hint for intake routing. Interpreter bridging is tenant config. */
export function detectCallAssistLanguage(utterance: string): CallAssistLanguage {
  const text = (utterance ?? "").trim();
  if (!text) return "und";
  if (SPANISH_CUES.test(text)) return "es";
  return "en";
}
