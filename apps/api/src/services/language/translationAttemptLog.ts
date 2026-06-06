/** Safe structured log line for translation routes (never include API keys or message body). */

export type TranslationAttemptLog = {
  event: "translation_attempt";
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
  success: boolean;
  durationMs: number;
  reason?: string;
  requestId?: string;
  agencyId?: string;
  incidentId?: string;
};

export function emitTranslationAttempt(line: TranslationAttemptLog) {
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(line));
}
