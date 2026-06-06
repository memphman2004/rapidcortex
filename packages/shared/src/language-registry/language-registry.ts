import { buildDefaultSupportedLanguages } from "./build-default-supported-languages.js";
import type { LanguageCapability, SupportedLanguage, TranslationProviderName } from "./types.js";

export type { LanguageCapability, SupportedLanguage };
export type { EmergencyPriorityTier, TranslationProviderName } from "./types.js";

/** Single source of truth; 100+ defaults (explicit + supplemental ISO). */
export const DEFAULT_SUPPORTED_CALL_LANGUAGES: SupportedLanguage[] = buildDefaultSupportedLanguages();

const byCanonicalLower = new Map<string, SupportedLanguage>();
for (const row of DEFAULT_SUPPORTED_CALL_LANGUAGES) {
  byCanonicalLower.set(row.code.toLowerCase(), row);
}

function registerAlias(aliasLower: string, targetCode: string) {
  const t = byCanonicalLower.get(targetCode.toLowerCase());
  if (t) byCanonicalLower.set(aliasLower, t);
}

registerAlias("fil", "tl");
registerAlias("fil-ph", "tl");
registerAlias("zh-cn", "zh-Hans");
registerAlias("zh-sg", "zh-Hans");
registerAlias("zh-tw", "zh-Hant");
registerAlias("zh-hk", "zh-Hant");
registerAlias("zh-mo", "zh-Hant");

export function getSupportedCallLanguages(): string[] {
  return DEFAULT_SUPPORTED_CALL_LANGUAGES.map((l) => l.code);
}

export type ParseSupportedCallLanguagesOptions = {
  /** When true, English may be omitted from the allowlist. Default false. */
  allowEnglishRemoval?: boolean;
  /** Invoked for each warning (invalid code, etc.). */
  onWarning?: (message: string) => void;
};

function warn(onWarning: ((m: string) => void) | undefined, message: string) {
  onWarning?.(message);
}

/**
 * Parse `SUPPORTED_CALL_LANGUAGES` CSV; validate against the central registry; dedupe; normalize casing.
 * When `raw` is empty/undefined, returns all default registry codes.
 */
export function parseSupportedCallLanguagesEnv(
  raw: string | undefined,
  options?: ParseSupportedCallLanguagesOptions,
): Set<string> {
  const res = parseSupportedCallLanguagesEnvDetailed(raw, options);
  return res.codes;
}

export function parseSupportedCallLanguagesEnvDetailed(
  raw: string | undefined,
  options?: ParseSupportedCallLanguagesOptions,
): { codes: Set<string>; warnings: string[] } {
  const warnings: string[] = [];
  const onWarn = (m: string) => {
    warnings.push(m);
    options?.onWarning?.(m);
  };

  const src = typeof raw === "string" ? raw.trim() : "";
  if (!src) {
    const codes = new Set(getSupportedCallLanguages());
    if (!options?.allowEnglishRemoval) {
      codes.add("en");
    }
    return { codes, warnings };
  }

  const parts = src
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dedup = new Set<string>();

  for (const p of parts) {
    const n = normalizeLanguageCode(p);
    if (n === "und") {
      warn(onWarn, `SUPPORTED_CALL_LANGUAGES ignored invalid or unknown code "${p}".`);
      continue;
    }
    const row = getLanguageByCodeInternal(n);
    if (!row) {
      warn(onWarn, `SUPPORTED_CALL_LANGUAGES ignored unsupported code "${p}" (normalized "${n}") — not in central registry.`);
      continue;
    }
    dedup.add(row.code);
  }

  if (!options?.allowEnglishRemoval) {
    dedup.add("en");
  }

  return { codes: dedup, warnings };
}

export function isSupportedCallLanguage(
  code: string | undefined,
  allowlist: Set<string>,
): boolean {
  if (!code) return false;
  const n = normalizeLanguageCode(code);
  if (n === "und") return false;
  const allow = new Set([...allowlist].map((x) => x.toLowerCase()));
  const nl = n.toLowerCase();
  if (allow.has(nl)) return true;
  const prim = primarySubtagLower(n);
  if (allow.has(prim)) return true;
  if (prim === "zh" || nl.startsWith("zh-")) {
    if (allow.has("zh") || allow.has("zh-hans") || allow.has("zh-hant")) return true;
  }
  if ((prim === "tl" || prim === "fil") && (allow.has("tl") || allow.has("fil"))) return true;
  return false;
}

function primarySubtagLower(code: string): string {
  return code.trim().split("-")[0]!.toLowerCase();
}

function getLanguageByCodeInternal(canonicalGuess: string): SupportedLanguage | undefined {
  const low = canonicalGuess.toLowerCase();
  return byCanonicalLower.get(low);
}

export function getLanguageByCode(code: string | undefined): SupportedLanguage | undefined {
  if (!code) return undefined;
  const n = normalizeLanguageCode(code);
  if (n === "und") return undefined;
  return getLanguageByCodeInternal(n);
}

export function getLanguagesByCapability(cap: keyof LanguageCapability): SupportedLanguage[] {
  return DEFAULT_SUPPORTED_CALL_LANGUAGES.filter((l) => l.capabilities[cap] === true);
}

/**
 * Canonical BCP-ish normalization for registry lookup. Returns `und` when unknown/empty.
 * Preserves script variants (e.g. zh-Hans) when present in the registry.
 */
export function normalizeLanguageCode(raw: string | undefined): string {
  if (!raw || !raw.trim()) return "und";
  const t = raw.trim();
  const lower = t.toLowerCase();

  if (byCanonicalLower.has(lower)) {
    return byCanonicalLower.get(lower)!.code;
  }

  if (lower === "fil" || lower.startsWith("fil-")) {
    return byCanonicalLower.get("tl")?.code ?? "tl";
  }
  if (lower === "iw") {
    return byCanonicalLower.get("he")?.code ?? "he";
  }
  if (lower === "in") {
    return byCanonicalLower.get("id")?.code ?? "id";
  }

  if (lower === "yue" || lower.startsWith("yue-")) {
    return byCanonicalLower.get("zh")?.code ?? "zh";
  }

  if (lower.startsWith("zh")) {
    if (lower.includes("hant") || lower.endsWith("-tw") || lower.endsWith("-hk") || lower.endsWith("-mo")) {
      const hit =
        byCanonicalLower.get("zh-hant") ?? byCanonicalLower.get("zh-tw");
      return hit?.code ?? "zh-Hant";
    }
    if (lower.includes("hans") || lower.endsWith("-cn") || lower.endsWith("-sg")) {
      const hit = byCanonicalLower.get("zh-hans");
      return hit?.code ?? "zh-Hans";
    }
    return byCanonicalLower.get("zh")?.code ?? "zh";
  }

  const primary = primarySubtagLower(lower);
  if (byCanonicalLower.has(primary)) {
    return byCanonicalLower.get(primary)!.code;
  }

  if (primary === "und" || primary === "auto") return "und";
  /** Unknown supplemental — allow loose primary routing for tooling; prefer registry misses as `und` for validation. */
  return primary.length >= 2 ? primary : "und";
}

/**
 * Annotate provider layering for translation. Azure is listed before Google where both apply.
 */
export function mergeProviderLanguageCapabilities(
  language: SupportedLanguage,
  azureSupported: boolean,
  googleSupported: boolean,
): SupportedLanguage {
  const translationProviders: TranslationProviderName[] = [];
  if (azureSupported) translationProviders.push("azure-translator");
  if (googleSupported) translationProviders.push("google-translate");

  const hasText = azureSupported || googleSupported;

  return {
    ...language,
    capabilities: {
      ...language.capabilities,
      translation: hasText && language.capabilities.translation,
      callerSms: hasText && language.capabilities.callerSms,
    },
    providers: {
      ...language.providers,
      translation: translationProviders,
    },
  };
}
