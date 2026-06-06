/**
 * High-level selection for text translation + (optional) TTS in services that are not the live voice STT path.
 * Complements per-tier env vars: `PRIMARY_TRANSLATION_PROVIDER`, `SECONDARY_*`, etc.
 */
export type MultilingualProviderMode = "aws" | "google" | "auto";

const MODES: MultilingualProviderMode[] = ["aws", "google", "auto"];

export function parseMultilingualProviderMode(
  value: string | undefined,
  defaultMode: MultilingualProviderMode = "auto",
): MultilingualProviderMode {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "aws" || v === "google" || v === "auto") return v;
  return defaultMode;
}

export function isMultilingualProviderMode(v: string): v is MultilingualProviderMode {
  return (MODES as string[]).includes(v);
}
