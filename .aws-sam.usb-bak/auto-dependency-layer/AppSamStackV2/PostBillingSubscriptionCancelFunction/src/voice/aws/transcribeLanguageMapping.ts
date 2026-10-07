import { normalizeCallLanguageCode, SUPPORTED_CALL_LANGUAGE_CODES } from "rapid-cortex-shared";

/**
 * Default pool for Amazon Transcribe `LanguageOptions` when `IdentifyLanguage` is enabled.
 * AWS allows at most **five** codes per job — see {@link buildAwsTranscribeIdentifyLanguageOptions}.
 */
export const DEFAULT_AWS_TRANSCRIBE_LANGUAGE_OPTIONS_CSV =
  "en-US,es-US,zh-CN,tl-PH,vi-VN,ar-SA,fr-FR,ko-KR,ru-RU,pt-BR";

/** AWS Transcribe batch `IdentifyLanguage` accepts at most five `LanguageCode` values. */
export const AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS = 5;

/** Minimum language options required by AWS when `IdentifyLanguage` is true. */
export const AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS = 2;

export function parseCommaSeparatedBcp47(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Map Rapid Cortex canonical call language (e.g. `es`, `zh`) to AWS Transcribe `LanguageCode`
 * for batch jobs (`LanguageCode` on `StartTranscriptionJob`).
 */
export function toAwsTranscribeLanguageCode(canonical: string | undefined): string {
  const c = normalizeCallLanguageCode(canonical);
  const map: Record<string, string> = {
    en: "en-US",
    es: "es-US",
    zh: "zh-CN",
    tl: "tl-PH",
    vi: "vi-VN",
    ar: "ar-SA",
    fr: "fr-FR",
    ko: "ko-KR",
    ru: "ru-RU",
    pt: "pt-BR",
    und: "en-US",
  };
  return map[c] ?? "en-US";
}

const supportedCanon = new Set<string>(SUPPORTED_CALL_LANGUAGE_CODES);

export function isInternalLanguageSupportedByTranscribeMapping(canonical: string): boolean {
  const c = normalizeCallLanguageCode(canonical);
  return c === "und" || supportedCanon.has(c);
}

/**
 * Build up to five AWS language codes for `IdentifyLanguage` + `LanguageOptions`, preferring
 * `preferredCsv` order then filling from `configuredPool` (usually `AWS_TRANSCRIBE_LANGUAGE_OPTIONS`).
 */
export function buildAwsTranscribeIdentifyLanguageOptions(configuredPoolCsv: string, preferredCsv: string): string[] {
  const pool = parseCommaSeparatedBcp47(
    configuredPoolCsv.trim() || DEFAULT_AWS_TRANSCRIBE_LANGUAGE_OPTIONS_CSV,
  );
  const preferred = parseCommaSeparatedBcp47(preferredCsv);
  const ordered: string[] = [];
  for (const p of preferred) {
    if (pool.includes(p) && !ordered.includes(p)) ordered.push(p);
  }
  for (const p of pool) {
    if (!ordered.includes(p)) ordered.push(p);
    if (ordered.length >= AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS) break;
  }
  return ordered.slice(0, AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS);
}
