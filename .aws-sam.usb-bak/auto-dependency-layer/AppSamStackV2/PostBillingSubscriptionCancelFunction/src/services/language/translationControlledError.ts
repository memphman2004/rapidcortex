/** Structured client-safe payload when translation is unavailable across providers (no PHI). */
export type TranslationUnavailablePayload = {
  ok: false;
  status: "translation_unavailable";
  sourceLanguage: string;
  targetLanguage: string;
  attemptedProviders: ("azure-translator" | "google-translate")[];
  message: string;
};

export class TranslationUnavailableError extends Error {
  readonly payload: TranslationUnavailablePayload;

  constructor(payload: Omit<TranslationUnavailablePayload, "ok" | "status">) {
    super(payload.message);
    this.name = "TranslationUnavailableError";
    this.payload = { ok: false, status: "translation_unavailable", ...payload };
  }
}
