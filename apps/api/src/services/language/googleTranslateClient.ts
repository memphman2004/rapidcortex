import type { MultilingualVoiceConfig } from "../../voice/multilingualConfig.js";
import { resolveGoogleServiceAccountCredentials } from "../../voice/google/googleCredentials.js";
import { getGoogleAccessToken } from "../../voice/google/googleAccessToken.js";
import {
  googleDetectLanguageV2,
  googleTranslateV2,
} from "../../voice/google/googleCloudTranslationRest.js";
import { toTranslatePrimaryTag } from "rapid-cortex-shared";

let credsMemo: ReturnType<typeof resolveGoogleServiceAccountCredentials> | null = null;

async function token(cfg: MultilingualVoiceConfig): Promise<string> {
  credsMemo ??= resolveGoogleServiceAccountCredentials(cfg);
  const c = await credsMemo;
  return getGoogleAccessToken(c, ["https://www.googleapis.com/auth/cloud-platform"]);
}

function resetCredsForTests() {
  credsMemo = null;
}

export { resetCredsForTests };

export async function googleMultilingualTranslateToEnglish(
  cfg: MultilingualVoiceConfig,
  text: string,
  sourceBcp: string,
  signal?: AbortSignal,
) {
  const t = toTranslatePrimaryTag(sourceBcp);
  if (t === "en") {
    return { text: text.trim(), sourceLanguage: "en", targetLanguage: "en", confidence: 1 as const };
  }
  const accessToken = await token(cfg);
  const out = await googleTranslateV2({
    accessToken,
    text,
    source: t === "und" ? undefined : t,
    target: "en",
    signal,
  });
  return {
    text: out.translatedText,
    sourceLanguage: toTranslatePrimaryTag(out.detectedSourceLanguage) || t,
    targetLanguage: "en" as const,
    confidence: 0.9 as const,
  };
}

export async function googleMultilingualTranslateFromEnglish(
  cfg: MultilingualVoiceConfig,
  text: string,
  targetBcp: string,
  signal?: AbortSignal,
) {
  const target = toTranslatePrimaryTag(targetBcp);
  if (target === "en") {
    return { text: text.trim(), sourceLanguage: "en" as const, targetLanguage: "en", confidence: 1 as const };
  }
  const accessToken = await token(cfg);
  const out = await googleTranslateV2({
    accessToken,
    text,
    source: "en",
    target,
    signal,
  });
  return {
    text: out.translatedText,
    sourceLanguage: "en" as const,
    targetLanguage: target,
    confidence: 0.9 as const,
  };
}

export async function googleMultilingualDetectLanguage(
  cfg: MultilingualVoiceConfig,
  text: string,
  signal?: AbortSignal,
) {
  const accessToken = await token(cfg);
  return googleDetectLanguageV2({ accessToken, text, signal });
}
