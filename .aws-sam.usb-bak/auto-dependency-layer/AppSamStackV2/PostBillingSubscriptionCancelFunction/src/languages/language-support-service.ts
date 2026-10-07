import {
  DEFAULT_SUPPORTED_CALL_LANGUAGES,
  mergeProviderLanguageCapabilities,
  normalizeLanguageCode,
  parseSupportedCallLanguagesEnvDetailed,
  type SupportedLanguage,
} from "rapid-cortex-shared";
import { getAzureTranslatorSupportedLanguages } from "./azure-translator-languages.js";
import { getGoogleTranslateSupportedLanguages } from "./google-translate-languages.js";
import { getMultilingualVoiceConfig } from "../voice/multilingualConfig.js";

export type EffectiveTranslationProviderId = "azure-translator" | "google-translate";

export type EffectiveLanguageSupportResult = {
  ok: boolean;
  primaryProvider: EffectiveTranslationProviderId;
  fallbackProvider: EffectiveTranslationProviderId;
  count: number;
  languages: SupportedLanguage[];
  warnings: string[];
};

type EmergencyTier = "core" | "high" | "standard";

function tierRank(t: EmergencyTier | undefined): number {
  if (t === "core") return 0;
  if (t === "high") return 1;
  return 2;
}

const CAPABILITY_KEYS = [
  "translation",
  "speechToText",
  "textToSpeech",
  "realTimeVoice",
  "callerSms",
  "dispatcherUi",
] as const;

type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

function parseCapabilitiesFilter(): CapabilityKey[] | null {
  const raw = process.env.SUPPORTED_CALL_LANGUAGE_CAPABILITIES?.trim();
  if (!raw) return null;
  const allowed = new Set<string>(CAPABILITY_KEYS);
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: CapabilityKey[] = [];
  for (const p of parts) {
    if (allowed.has(p)) out.push(p as CapabilityKey);
  }
  return out.length ? out : null;
}

function parseMinPriority(): EmergencyTier | null {
  const v = process.env.SUPPORTED_CALL_LANGUAGE_MIN_PRIORITY?.trim().toLowerCase();
  if (!v) return null;
  if (v === "core" || v === "high" || v === "standard") return v;
  return null;
}

function parsePrimaryFallback(): {
  primary: EffectiveTranslationProviderId;
  fallback: EffectiveTranslationProviderId;
} {
  const primary = (process.env.TRANSLATION_PRIMARY_PROVIDER ?? "azure-translator").trim().toLowerCase();
  const fallback = (process.env.TRANSLATION_FALLBACK_PROVIDER ?? "google-translate").trim().toLowerCase();
  return {
    primary: primary === "google-translate" ? "google-translate" : "azure-translator",
    fallback: fallback === "google-translate" ? "google-translate" : "azure-translator",
  };
}

function toSet(codes: string[]): Set<string> {
  return new Set(codes.map((c) => c.toLowerCase()));
}

function providerCovers(providerCodes: Set<string>, lang: SupportedLanguage): boolean {
  const c = lang.code.toLowerCase();
  const primary = c.split("-")[0] ?? c;
  if (providerCodes.has(c) || providerCodes.has(primary)) return true;
  if (primary === "zh") {
    return (
      [...providerCodes].some((x) => x.startsWith("zh")) ||
      providerCodes.has("zh-hans") ||
      providerCodes.has("zh-hant")
    );
  }
  if (primary === "tl" || c === "fil") {
    return providerCodes.has("tl") || providerCodes.has("fil");
  }
  return false;
}

/**
 * Provider-backed effective language list respecting `SUPPORTED_CALL_LANGUAGES`, capabilities, and min priority.
 */
export async function getEffectiveSupportedLanguages(signal?: AbortSignal): Promise<EffectiveLanguageSupportResult> {
  const warnings: string[] = [];
  const cfg = getMultilingualVoiceConfig();
  const allowEnglishRemoval = process.env.ALLOW_ENGLISH_LANGUAGE_REMOVAL?.trim().toLowerCase() === "true";
  const parsed = parseSupportedCallLanguagesEnvDetailed(process.env.SUPPORTED_CALL_LANGUAGES, {
    allowEnglishRemoval,
    onWarning: (m: string) => warnings.push(m),
  });
  const allowed = parsed.codes;
  warnings.push(...parsed.warnings);

  const [az, g] = await Promise.all([
    getAzureTranslatorSupportedLanguages(signal),
    getGoogleTranslateSupportedLanguages(cfg, signal),
  ]);

  warnings.push(...az.warnings, ...g.warnings);

  const azureSet = toSet(az.translationLanguageCodes);
  const googleSet = toSet(g.translationLanguageCodes);

  const capFilter = parseCapabilitiesFilter();
  const minPri = parseMinPriority();
  const pf = parsePrimaryFallback();

  const missingProvider: string[] = [];

  const merged: SupportedLanguage[] = [];
  for (const row of DEFAULT_SUPPORTED_CALL_LANGUAGES) {
    if (!allowed.has(row.code)) continue;
    const azOk = az.ok && providerCovers(azureSet, row);
    const gOk = g.ok && providerCovers(googleSet, row);

    if (!azOk && !gOk) {
      missingProvider.push(row.code);
    }

    let annotated = mergeProviderLanguageCapabilities(row, azOk, gOk);

    if (!azOk && !gOk) {
      annotated = {
        ...annotated,
        capabilities: { ...annotated.capabilities, translation: false, callerSms: false },
        providers: { ...annotated.providers, translation: [] },
      };
    }

    if (capFilter?.length) {
      const ok = capFilter.every((k) => Boolean(annotated.capabilities[k]));
      if (!ok) continue;
    }
    if (minPri) {
      const pr = (annotated.emergencyPriority ?? "standard") as EmergencyTier;
      if (tierRank(pr) > tierRank(minPri)) continue;
    }

    merged.push(annotated);
  }

  merged.sort((a, b) => {
    const tr = tierRank(a.emergencyPriority) - tierRank(b.emergencyPriority);
    if (tr !== 0) return tr;
    return a.name.localeCompare(b.name);
  });

  if (missingProvider.length) {
    warnings.push(
      `Some override languages are listed in the registry but are not currently advertised by active translation providers: ${missingProvider.slice(0, 12).join(", ")}${missingProvider.length > 12 ? ", …" : ""}.`,
    );
  }

  return {
    ok: true,
    primaryProvider: pf.primary,
    fallbackProvider: pf.fallback,
    count: merged.length,
    languages: merged,
    warnings,
  };
}

export function resolveDefaultLanguageCode(): string {
  return normalizeLanguageCode("en");
}
