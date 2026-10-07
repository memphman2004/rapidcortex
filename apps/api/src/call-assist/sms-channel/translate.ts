import {
  ComprehendClient,
  DetectDominantLanguageCommand,
} from "@aws-sdk/client-comprehend";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import {
  detectCallAssistLanguage,
  normalizePreferredLanguage,
  type CallAssistLanguage,
} from "rapid-cortex-shared";

const MIN_DETECT_CONFIDENCE = 0.65;
const TOKEN_RE = /\b([A-Z]{2}-\d{4}-[ACDEFGHJKMNPQRTUVWXYZ234679]{4})\b/g;

let comprehend: ComprehendClient | null = null;
let translate: TranslateClient | null = null;

function comprehendClient(): ComprehendClient {
  if (!comprehend) comprehend = new ComprehendClient({ region: process.env.AWS_REGION || "us-east-1" });
  return comprehend;
}

function translateClient(): TranslateClient {
  if (!translate) translate = new TranslateClient({ region: process.env.AWS_REGION || "us-east-1" });
  return translate;
}

export function smsTranslateEnabled(): boolean {
  const v = process.env.ENABLE_CALL_ASSIST_SMS_TRANSLATE?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export function smsTranslateMock(): boolean {
  const a = process.env.CALL_ASSIST_SMS_TRANSLATE_MOCK?.trim().toLowerCase();
  if (a === "true" || a === "1") return true;
  const b = process.env.TRANSLATE_MOCK?.trim().toLowerCase();
  return b === "true" || b === "1";
}

/** Amazon Translate language code. `en` means no translation. */
export type SmsTranslateLang = string;

export function callLanguageToTranslateCode(lang: CallAssistLanguage | string): SmsTranslateLang {
  switch (normalizePreferredLanguage(lang)) {
    case "es":
      return "es";
    case "zh":
      return "zh";
    case "yue":
      return "zh-TW";
    case "tl":
      return "tl";
    case "vi":
      return "vi";
    case "ar":
      return "ar";
    default:
      return "en";
  }
}

function comprehendToTranslateCode(code: string): SmsTranslateLang {
  const c = code.trim().toLowerCase();
  if (c === "zh-tw" || c === "zh-hant") return "zh-TW";
  if (c === "zh" || c === "zh-cn" || c === "zh-hans") return "zh";
  if (c === "fil") return "tl";
  if (["es", "en", "ar", "vi", "tl", "pt", "fr", "ko", "ht", "de", "it", "ja", "pl", "ru", "uk"].includes(c)) {
    return c;
  }
  return callLanguageToTranslateCode(c);
}

function protectTokens(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(TOKEN_RE, (m) => {
    const i = tokens.length;
    tokens.push(m);
    return `[[T${i}]]`;
  });
  return { masked, tokens };
}

function restoreTokens(text: string, tokens: string[]): string {
  let out = text;
  tokens.forEach((tok, i) => {
    out = out.replace(new RegExp(`\\[\\[T${i}\\]\\]`, "g"), tok);
  });
  return out;
}

export async function detectSmsLanguage(
  text: string,
  prior?: string | null,
): Promise<SmsTranslateLang> {
  const trimmed = text.trim();
  if (!trimmed) return prior && prior !== "en" ? prior : "en";

  if (/^(yes|no|y|n|ok|okay|si|sí|confirm|submit|nope)$/i.test(trimmed) || trimmed.length < 8) {
    if (prior && prior !== "en") return prior;
  }

  if (smsTranslateMock()) {
    const heuristic = detectCallAssistLanguage(trimmed);
    const code = callLanguageToTranslateCode(heuristic);
    if (code !== "en") return code;
    return prior && prior !== "en" ? prior : "en";
  }

  try {
    const out = await comprehendClient().send(new DetectDominantLanguageCommand({ Text: trimmed.slice(0, 5000) }));
    const top = [...(out.Languages ?? [])].sort((a, b) => (b.Score ?? 0) - (a.Score ?? 0))[0];
    if (top?.LanguageCode && (top.Score ?? 0) >= MIN_DETECT_CONFIDENCE) {
      return comprehendToTranslateCode(top.LanguageCode);
    }
  } catch (err: unknown) {
    console.warn(
      JSON.stringify({
        event: "sms_language_detect_failed",
        name: err instanceof Error ? err.name : "Error",
      }),
    );
  }

  const heuristic = detectCallAssistLanguage(trimmed);
  const code = callLanguageToTranslateCode(heuristic);
  if (code !== "en") return code;
  return prior && prior !== "en" ? prior : "en";
}

export async function translateSmsText(
  text: string,
  source: SmsTranslateLang,
  target: SmsTranslateLang,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (!smsTranslateEnabled()) return trimmed;
  if (source === target || target === "auto") return trimmed;
  if (source === "en" && target === "en") return trimmed;

  const { masked, tokens } = protectTokens(trimmed);

  if (smsTranslateMock()) {
    return restoreTokens(mockTranslate(masked, source, target), tokens);
  }

  try {
    const out = await translateClient().send(
      new TranslateTextCommand({
        Text: masked,
        SourceLanguageCode: source === "en" ? "en" : source,
        TargetLanguageCode: target,
      }),
    );
    return restoreTokens((out.TranslatedText ?? trimmed).trim(), tokens);
  } catch (err: unknown) {
    console.warn(
      JSON.stringify({
        event: "sms_translate_failed",
        name: err instanceof Error ? err.name : "Error",
        source,
        target,
      }),
    );
    return trimmed;
  }
}

export async function toEnglishForLex(text: string, lang: SmsTranslateLang): Promise<string> {
  if (!lang || lang === "en") return text;
  return translateSmsText(text, lang, "en");
}

export async function fromEnglishToCitizen(text: string, lang: SmsTranslateLang): Promise<string> {
  if (!lang || lang === "en") return text;
  return translateSmsText(text, "en", lang);
}

function mockTranslate(text: string, source: string, target: string): string {
  if (source === target) return text;
  if (target === "en" && source === "es") {
    return text
      .replace(/\bhola\b/gi, "hello")
      .replace(/\bhay un bache\b/gi, "there is a pothole")
      .replace(/\ben la calle\b/gi, "on the street")
      .replace(/\bsí\b/gi, "yes")
      .replace(/\bsi\b/gi, "yes")
      .replace(/\bayuda\b/gi, "help");
  }
  if (target === "es" && source === "en") {
    return text
      .replace(/What's the address or nearest intersection\?/gi, "¿Cuál es la dirección o la intersección más cercana?")
      .replace(/Is this happening right now\?/gi, "¿Esto está pasando ahora mismo?")
      .replace(/For emergencies call 911/gi, "Para emergencias llame al 911")
      .replace(/Confirmation:/gi, "Confirmación:");
  }
  return text;
}
