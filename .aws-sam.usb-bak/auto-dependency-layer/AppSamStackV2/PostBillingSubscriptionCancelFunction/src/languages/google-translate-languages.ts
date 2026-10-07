import { DEFAULT_SUPPORTED_CALL_LANGUAGES, type SupportedLanguage } from "rapid-cortex-shared";
import { getGoogleAccessToken } from "../voice/google/googleAccessToken.js";
import { resolveGoogleServiceAccountCredentials } from "../voice/google/googleCredentials.js";
import type { MultilingualVoiceConfig } from "../voice/multilingualConfig.js";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CacheEntry = { expiresAt: number; codes: Set<string> };

let cache: CacheEntry | null = null;

export type GoogleTranslateLanguagesResult = {
  provider: "google-translate";
  ok: boolean;
  translationLanguageCodes: string[];
  warnings: string[];
};

/**
 * Static fallback when Discovery API is unreachable (codes from the central registry defaults).
 */
export function getStaticGoogleTranslateLanguageFallback(): string[] {
  return DEFAULT_SUPPORTED_CALL_LANGUAGES.map((l: SupportedLanguage) => l.code.toLowerCase());
}

/**
 * Google Translate v2 supported languages (requires Cloud Translation API + credentials when available).
 */
export async function getGoogleTranslateSupportedLanguages(
  cfg?: MultilingualVoiceConfig,
  signal?: AbortSignal,
): Promise<GoogleTranslateLanguagesResult> {
  const warnings: string[] = [];
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return {
      provider: "google-translate",
      ok: true,
      translationLanguageCodes: [...cache.codes].sort(),
      warnings: [],
    };
  }

  if (!cfg?.googleCloudProjectId || (!cfg.googleCredentialsSecretArn && !cfg.googleApplicationCredentialsJson)) {
    warnings.push("Google credentials not configured — using static fallback list for Google language codes.");
    const codes = new Set(getStaticGoogleTranslateLanguageFallback());
    cache = { expiresAt: now + CACHE_TTL_MS, codes };
    return {
      provider: "google-translate",
      ok: true,
      translationLanguageCodes: [...codes].sort(),
      warnings,
    };
  }

  try {
    const creds = await resolveGoogleServiceAccountCredentials(cfg);
    const accessToken = await getGoogleAccessToken(creds, ["https://www.googleapis.com/auth/cloud-platform"]);
    const res = await fetch("https://translation.googleapis.com/language/translate/v2/languages", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });

    if (!res.ok) {
      warnings.push(`Google languages HTTP ${res.status} — using static fallback list.`);
      const codes = new Set(getStaticGoogleTranslateLanguageFallback());
      cache = { expiresAt: now + 120_000, codes };
      return {
        provider: "google-translate",
        ok: false,
        translationLanguageCodes: [...codes].sort(),
        warnings,
      };
    }

    const json = (await res.json()) as {
      data?: { languages?: { language?: string }[] };
    };
    const rows = json.data?.languages ?? [];
    const codes = new Set<string>();
    for (const row of rows) {
      const lc = row.language?.trim().toLowerCase();
      if (lc) codes.add(lc);
    }
    if (!codes.size) {
      warnings.push("Google languages returned no entries — using static fallback list.");
      const fb = new Set(getStaticGoogleTranslateLanguageFallback());
      cache = { expiresAt: now + 120_000, codes: fb };
      return {
        provider: "google-translate",
        ok: false,
        translationLanguageCodes: [...fb].sort(),
        warnings,
      };
    }

    cache = { expiresAt: now + CACHE_TTL_MS, codes };
    return {
      provider: "google-translate",
      ok: true,
      translationLanguageCodes: [...codes].sort(),
      warnings,
    };
  } catch (e) {
    warnings.push(
      `Google languages fetch failed (${e instanceof Error ? e.message : "unknown"}) — using static fallback list.`,
    );
    const codes = new Set(getStaticGoogleTranslateLanguageFallback());
    cache = { expiresAt: now + 120_000, codes };
    return {
      provider: "google-translate",
      ok: false,
      translationLanguageCodes: [...codes].sort(),
      warnings,
    };
  }
}

export function __resetGoogleTranslateLanguagesCacheForTests() {
  cache = null;
}
