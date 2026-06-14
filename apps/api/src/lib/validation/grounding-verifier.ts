export type GroundingFlag = {
  field: string;
  originalValue: string;
  reason: string;
  gate: "source_citation" | "lexical_terms";
};

export type GroundedFieldResult = {
  value: string | null;
  sourceQuote: string | null;
  scoreCap?: number;
  reasonSuffix?: string;
  flag?: GroundingFlag;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "at",
  "in",
  "on",
  "of",
  "and",
  "or",
  "to",
  "is",
  "it",
  "he",
  "she",
  "they",
  "with",
  "from",
  "near",
  "by",
]);

/** Normalize text for substring / token matching (STT-tolerant). */
export function normalizeForGrounding(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Spoken-number variants → digits for address matching. */
function expandSpokenNumbers(text: string): string {
  const words: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
  };
  return text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (m) => words[m] ?? m);
}

function tokenize(value: string): string[] {
  const normalized = expandSpokenNumbers(normalizeForGrounding(value));
  return normalized
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Layer 2 — source quote must appear (approximately) in the transcript.
 */
export function isQuoteGroundedInTranscript(sourceQuote: string | null | undefined, transcript: string): boolean {
  if (!sourceQuote?.trim()) return false;
  const quoteNorm = normalizeForGrounding(sourceQuote);
  const transcriptNorm = normalizeForGrounding(transcript);
  if (!quoteNorm) return false;
  if (transcriptNorm.includes(quoteNorm)) return true;

  const quoteTokens = tokenize(sourceQuote);
  if (quoteTokens.length === 0) return false;
  const matched = quoteTokens.filter((t) => transcriptNorm.includes(t));
  return matched.length / quoteTokens.length >= 0.7;
}

/**
 * Layer 3 — key terms from extracted value must appear in transcript.
 */
export function areKeyTermsGrounded(value: string, transcript: string): boolean {
  const terms = tokenize(value);
  if (terms.length === 0) return false;
  const transcriptNorm = normalizeForGrounding(transcript);
  const matched = terms.filter((t) => transcriptNorm.includes(t));
  return matched.length / terms.length >= 0.6;
}

/**
 * Apply citation + lexical gates. Ungrounded extractions become null (citation fail)
 * or capped low confidence (lexical fail).
 */
export function applyFieldGrounding(params: {
  field: string;
  value: string | null;
  sourceQuote?: string | null;
  transcript: string;
}): GroundedFieldResult {
  const { field, value, sourceQuote, transcript } = params;
  if (!value?.trim()) {
    return { value: null, sourceQuote: null };
  }

  if (!isQuoteGroundedInTranscript(sourceQuote, transcript)) {
    return {
      value: null,
      sourceQuote: null,
      reasonSuffix: "Removed — no verifiable transcript citation.",
      flag: {
        field,
        originalValue: value,
        reason: "Missing or ungrounded sourceQuote",
        gate: "source_citation",
      },
    };
  }

  if (!areKeyTermsGrounded(value, transcript)) {
    return {
      value: null,
      sourceQuote: sourceQuote ?? null,
      reasonSuffix: "Removed — extracted terms not found in transcript.",
      flag: {
        field,
        originalValue: value,
        reason: "Lexical grounding check failed",
        gate: "lexical_terms",
      },
    };
  }

  return { value: value.trim(), sourceQuote: sourceQuote?.trim() ?? null };
}

export function applyGroundingToFields<T extends { field: string; value: string | null; sourceQuote?: string | null }>(
  fields: T[],
  transcript: string,
): { fields: T[]; flags: GroundingFlag[] } {
  const flags: GroundingFlag[] = [];
  const next = fields.map((row) => {
    const grounded = applyFieldGrounding({
      field: row.field,
      value: row.value,
      sourceQuote: row.sourceQuote,
      transcript,
    });
    if (grounded.flag) flags.push(grounded.flag);
    return { ...row, value: grounded.value, sourceQuote: grounded.sourceQuote };
  });
  return { fields: next, flags };
}
