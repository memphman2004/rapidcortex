/**
 * Public Azure Translator languages API (no subscription key required).
 * @see https://learn.microsoft.com/en-us/azure/ai-services/translator/reference/v3-0/languages
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type Cache = { expiresAt: number; codes: Set<string> };

let cache: Cache | null = null;

export type AzureTranslatorLanguagesResult = {
  provider: "azure-translator";
  ok: boolean;
  translationLanguageCodes: string[];
  warnings: string[];
};

function normalizeMsCode(key: string): string {
  const k = key.trim().toLowerCase();
  /** Keep script variants (e.g. zh-hans) lowercase for consistent matching. */
  return k.replace(/_/g, "-");
}

export async function getAzureTranslatorSupportedLanguages(signal?: AbortSignal): Promise<AzureTranslatorLanguagesResult> {
  const warnings: string[] = [];
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return {
      provider: "azure-translator",
      ok: true,
      translationLanguageCodes: [...cache.codes].sort(),
      warnings: [],
    };
  }

  const url = "https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      warnings.push(`Azure languages HTTP ${res.status} — using static registry fallback.`);
      cache = { expiresAt: now + 120_000, codes: new Set() };
      return { provider: "azure-translator", ok: false, translationLanguageCodes: [], warnings };
    }

    const json = (await res.json()) as {
      translation?: Record<string, unknown>;
    };

    const translation = json.translation ?? {};
    const codes = new Set<string>();
    for (const k of Object.keys(translation)) {
      codes.add(normalizeMsCode(k));
    }

    cache = { expiresAt: now + CACHE_TTL_MS, codes };
    return {
      provider: "azure-translator",
      ok: true,
      translationLanguageCodes: [...codes].sort(),
      warnings,
    };
  } catch (e) {
    warnings.push(
      `Azure languages fetch failed (${e instanceof Error ? e.message : "unknown"}) — using static registry fallback.`,
    );
    cache = { expiresAt: now + 120_000, codes: new Set() };
    return { provider: "azure-translator", ok: false, translationLanguageCodes: [], warnings };
  }
}

export function __resetAzureTranslatorLanguagesCacheForTests() {
  cache = null;
}
