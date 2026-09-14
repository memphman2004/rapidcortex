import { normalizeGreetingLocale } from "./greeting.js";
import { callLanguageToLexLocale, normalizePreferredLanguage } from "./language.js";
import {
  CALL_ASSIST_911_LANGUAGE_PACK,
  CALL_ASSIST_LOCALE_META,
  type CallAssistLocale,
} from "./lex/provisioning-types.js";

/** Lex locales Amazon Connect can select on a live Call Assist DID. fr_CA stays typed-only. */
export const CONNECT_LIVE_LEX_LOCALES: readonly CallAssistLocale[] = [
  "en_US",
  "es_US",
  ...CALL_ASSIST_911_LANGUAGE_PACK,
];

/** Single-digit DTMF on the opening language menu. Timeout uses the tenant default. */
export const CONNECT_LANGUAGE_MENU_DTMF: Readonly<Record<string, CallAssistLocale>> = {
  "1": "en_US",
  "2": "es_US",
  "3": "zh_CN",
  "4": "zh_HK",
  "5": "tl_PH",
  "6": "vi_VN",
  "7": "ar_AE",
};

export const CONNECT_LANGUAGE_MENU_PROMPT =
  "To continue in English, press 1. Spanish, press 2. Mandarin, press 3. Cantonese, press 4. Tagalog, press 5. Vietnamese, press 6. Arabic, press 7. Or stay on the line for the default language.";

export type ConnectLivePrompts = {
  transfer: string;
  error: string;
  transferFail: string;
};

const CONNECT_LIVE_PROMPTS: Record<string, ConnectLivePrompts> = {
  "en-US": {
    transfer: "I'm transferring you to someone who can help. Please hold.",
    error: "I'm having trouble right now. Connecting you to someone who can help.",
    transferFail: "I'm sorry, I wasn't able to connect you. Please try again.",
  },
  "es-US": {
    transfer: "Le estoy transfiriendo con alguien que puede ayudarle. Por favor espere.",
    error: "Estoy teniendo un problema en este momento. Le conectaré con alguien que puede ayudarle.",
    transferFail: "Lo siento, no pude conectarle. Por favor intente de nuevo.",
  },
  "zh-CN": {
    transfer: "我正在为您转接能提供帮助的工作人员，请稍候。",
    error: "系统出现问题，正在为您转接工作人员。",
    transferFail: "很抱歉，未能接通。请稍后再试。",
  },
  "zh-HK": {
    transfer: "我而家幫你轉接可以幫到你嘅人，請稍等。",
    error: "而家系統有問題，我幫你轉接工作人員。",
    transferFail: "對唔住，而家接唔通。請稍後再試。",
  },
  "tl-PH": {
    transfer: "Inililipat kita sa taong makakatulong. Pakihintay po.",
    error: "May problema po ngayon. Ikinokonekta kita sa taong makakatulong.",
    transferFail: "Paumanhin, hindi kita makonektá. Subukan po ulit.",
  },
  "vi-VN": {
    transfer: "Tôi đang chuyển máy cho người có thể giúp bạn. Vui lòng chờ.",
    error: "Hiện hệ thống gặp sự cố. Tôi sẽ chuyển bạn tới người có thể giúp.",
    transferFail: "Xin lỗi, tôi không kết nối được. Vui lòng thử lại.",
  },
  "ar-AE": {
    transfer: "سأحولكم الآن إلى شخص يمكنه المساعدة. يرجى الانتظار.",
    error: "نواجه مشكلة حالياً. سأصلكم بمن يمكنه المساعدة.",
    transferFail: "عذراً، تعذر التوصيل. يرجى المحاولة مرة أخرى.",
  },
};

export function connectLiveLexLocale(locale: string | null | undefined): CallAssistLocale {
  const lex = callLanguageToLexLocale(normalizePreferredLanguage(normalizeGreetingLocale(locale)));
  return (CONNECT_LIVE_LEX_LOCALES as readonly string[]).includes(lex) ? (lex as CallAssistLocale) : "en_US";
}

export function connectVoiceForLocale(locale: string | null | undefined): {
  voiceId: string;
  engine: "Neural";
} {
  const meta = CALL_ASSIST_LOCALE_META[connectLiveLexLocale(locale)];
  return { voiceId: meta.voiceId, engine: "Neural" };
}

export function connectLivePrompts(locale: string | null | undefined): ConnectLivePrompts {
  const bcp47 = CALL_ASSIST_LOCALE_META[connectLiveLexLocale(locale)].bcp47;
  return CONNECT_LIVE_PROMPTS[bcp47] ?? CONNECT_LIVE_PROMPTS["en-US"];
}

/** Dynamo/Connect STRING_MAP suffix: `greeting_zh_CN`. */
export function connectLocaleAttrSuffix(locale: string | null | undefined): string {
  return connectLiveLexLocale(locale);
}

export function resolveConnectStartLocale(opts: {
  eventLocale?: string | null;
  tenantDefault?: string | null;
}): string {
  return CALL_ASSIST_LOCALE_META[connectLiveLexLocale(opts.eventLocale?.trim() || opts.tenantDefault || "en-US")]
    .bcp47;
}
