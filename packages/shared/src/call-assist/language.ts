export type CallAssistLanguage = "en" | "es" | "und";

const SPANISH_CUES =
  /\b(hola|buenos d[ií]as|buenas tardes|buenas noches|por favor|emergencia|auxilio|ay[uú]dame|calle|carro|veh[ií]culo|polic[ií]a|d[oó]nde|qu[eé]|ruido|estacionamiento|apartamento|herido|arma|placa|necesito|hablar)\b/i;

export function normalizePreferredLanguage(value: string | null | undefined): CallAssistLanguage {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "und";
  if (raw.startsWith("es") || raw === "spanish" || raw === "espa\u00f1ol" || raw === "espanol") return "es";
  if (raw.startsWith("en") || raw === "english" || raw === "ingl\u00e9s" || raw === "ingles") return "en";
  return "und";
}

/** Heuristic language hint for intake routing. Interpreter bridging is tenant config. */
export function detectCallAssistLanguage(utterance: string): CallAssistLanguage {
  const text = (utterance ?? "").trim();
  if (!text) return "und";
  if (SPANISH_CUES.test(text)) return "es";
  return "en";
}
