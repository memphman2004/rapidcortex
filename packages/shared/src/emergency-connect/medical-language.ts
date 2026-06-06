/** Phrases that imply definitive diagnosis — discouraged in pre-arrival alerts. */
const DEFINITIVE_PATTERNS: RegExp[] = [
  /\bpatient has\b/i,
  /\bconfirmed\b/i,
  /\bdiagnosed with\b/i,
  /\bdefinite\b/i,
  /\bdefinitive\b/i,
];

/**
 * Returns validation issues when free-text uses definitive medical language.
 * Prefer "possible", "suspected", or "potential" wording.
 */
export function validateQualifiedMedicalLanguage(text: string): string[] {
  const issues: string[] = [];
  for (const pattern of DEFINITIVE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(
        `Use qualified language (e.g. "possible" or "suspected") instead of definitive phrasing matching: ${pattern.source}`,
      );
    }
  }
  return issues;
}
