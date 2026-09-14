export type CallAssistLanguage = "en" | "es" | "zh" | "yue" | "tl" | "vi" | "ar" | "und";

const SPANISH_CUES =
  /\b(hola|buenos d[ií]as|buenas tardes|buenas noches|por favor|emergencia|auxilio|ay[uú]dame|calle|carro|veh[ií]culo|polic[ií]a|d[oó]nde|qu[eé]|ruido|estacionamiento|apartamento|herido|arma|placa|necesito|hablar)\b/i;

const TAGALOG_CUES =
  /\b(opo|tulong|pulis|reklamo|nakaw|aksidente|kapitbahay|baril|sunog|hindi|kailangan|mag-report)\b/i;

const VIETNAMESE_CUES =
  /\b(tôi|xin chào|giúp|cảnh sát|khẩn cấp|cháy|súng|trộm|tai nạn|hàng xóm|điện thoại|không)\b/i;

const CANTONESE_PARTICLES = /[嘅喺唔係哋咗啲嘈冇]/;

export function normalizePreferredLanguage(value: string | null | undefined): CallAssistLanguage {
  const raw = (value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!raw) return "und";
  if (raw.startsWith("es") || raw === "spanish" || raw === "español" || raw === "espanol") return "es";
  if (raw.startsWith("zh-hk") || raw.startsWith("zh-yue") || raw.startsWith("yue") || raw === "cantonese") {
    return "yue";
  }
  if (raw.startsWith("zh") || raw === "chinese" || raw === "mandarin") return "zh";
  if (raw.startsWith("tl") || raw.startsWith("fil") || raw === "tagalog" || raw === "filipino") return "tl";
  if (raw.startsWith("vi") || raw === "vietnamese") return "vi";
  if (raw.startsWith("ar") || raw === "arabic") return "ar";
  if (raw.startsWith("en") || raw === "english" || raw === "inglés" || raw === "ingles") return "en";
  return "und";
}

export function lexLocaleToCallLanguage(localeId: string | null | undefined): CallAssistLanguage {
  const id = (localeId ?? "").trim().replace(/-/g, "_").toLowerCase();
  if (!id) return "und";
  if (id.startsWith("es")) return "es";
  if (id.startsWith("zh_hk") || id.startsWith("yue")) return "yue";
  if (id.startsWith("zh")) return "zh";
  if (id.startsWith("tl") || id.startsWith("fil")) return "tl";
  if (id.startsWith("vi")) return "vi";
  if (id.startsWith("ar")) return "ar";
  if (id.startsWith("en")) return "en";
  return "und";
}

export function callLanguageToLexLocale(language: CallAssistLanguage | string | null | undefined): string {
  switch ((language ?? "").toLowerCase()) {
    case "es":
      return "es_US";
    case "zh":
      return "zh_CN";
    case "yue":
      return "zh_HK";
    case "tl":
    case "fil":
      return "tl_PH";
    case "vi":
      return "vi_VN";
    case "ar":
      return "ar_AE";
    default:
      return "en_US";
  }
}

/** Heuristic language hint for intake routing. Interpreter bridging is tenant config. */
export function detectCallAssistLanguage(utterance: string): CallAssistLanguage {
  const text = (utterance ?? "").trim();
  if (!text) return "und";
  if (/\p{Script=Arabic}/u.test(text)) return "ar";
  if (/\p{Script=Han}/u.test(text)) {
    return CANTONESE_PARTICLES.test(text) ? "yue" : "zh";
  }
  if (SPANISH_CUES.test(text)) return "es";
  if (VIETNAMESE_CUES.test(text) && /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text)) {
    return "vi";
  }
  if (TAGALOG_CUES.test(text)) return "tl";
  return "en";
}
