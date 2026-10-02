type RedactionType =
  | "ssn"
  | "phone"
  | "email"
  | "address"
  | "case_number"
  | "officer_name"
  | "sensitive_term";

export type SanitizationMetadata = {
  redactions: { type: RedactionType; matches: number }[];
  totalRedactions: number;
  redactedTerms: string[];
};

export type SanitizedProviderPayload = {
  sanitizedContent: string;
  metadata: SanitizationMetadata;
};

type SanitizationRule = {
  type: RedactionType;
  replacement: string;
  regex: RegExp;
};

const SENSITIVE_TERMS = ["warrant", "arrest", "victim", "suspect", "officer"];
const SENSITIVE_TERM_REGEX = new RegExp(`\\b(${SENSITIVE_TERMS.join("|")})\\b`, "gi");

const RULES: SanitizationRule[] = [
  { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED_SSN]" },
  {
    type: "phone",
    regex: /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
    replacement: "[REDACTED_PHONE]",
  },
  {
    type: "email",
    regex: /\b\S+@\S+\.\S+\b/g,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    type: "case_number",
    regex: /\b(case\s*(number|#)?\s*[:\-]?\s*[A-Z0-9-]{4,})\b/gi,
    replacement: "[REDACTED_CASE_NUMBER]",
  },
  {
    type: "address",
    regex:
      /\b\d{1,5}\s+[A-Za-z0-9.'-]+\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct)\b/gi,
    replacement: "[REDACTED_ADDRESS]",
  },
  {
    type: "officer_name",
    regex: /\b(officer|ofc|detective|det)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/gi,
    replacement: "[REDACTED_OFFICER_NAME]",
  },
];

/**
 * Regex-focused PII/sensitive-term minimization before third-party AI/STT/translation providers.
 * Keeps transcript structure while replacing direct identifiers.
 */
export function sanitizeForProvider(input: {
  content: string;
  provider: string;
  incidentId?: string;
  agencyId?: string;
}): SanitizedProviderPayload {
  let sanitized = input.content ?? "";
  const counts = new Map<RedactionType, number>();

  for (const rule of RULES) {
    const matches = sanitized.match(rule.regex)?.length ?? 0;
    if (matches > 0) {
      counts.set(rule.type, (counts.get(rule.type) ?? 0) + matches);
      sanitized = sanitized.replace(rule.regex, rule.replacement);
    }
  }

  const termMatches = sanitized.match(SENSITIVE_TERM_REGEX) ?? [];
  if (termMatches.length > 0) {
    counts.set("sensitive_term", (counts.get("sensitive_term") ?? 0) + termMatches.length);
    sanitized = sanitized.replace(SENSITIVE_TERM_REGEX, "[REDACTED_TERM]");
  }

  const redactions = [...counts.entries()].map(([type, matches]) => ({ type, matches }));
  const metadata: SanitizationMetadata = {
    redactions,
    totalRedactions: redactions.reduce((n, r) => n + r.matches, 0),
    redactedTerms: [...new Set(termMatches.map((x) => x.toLowerCase()))],
  };

  if (metadata.totalRedactions > 0) {
    console.log(
      JSON.stringify({
        type: "security.provider_sanitization",
        provider: input.provider,
        incidentId: input.incidentId,
        agencyId: input.agencyId,
        metadata,
        at: new Date().toISOString(),
      }),
    );
  }

  return { sanitizedContent: sanitized, metadata };
}
