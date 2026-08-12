/**
 * LA28 / RAMP (rampla.org) relevance filters for Rapid IQ.
 */

/** Keywords that indicate an RC-relevant LA28 opportunity (title + description). */
export const RAMP_RELEVANT_KEYWORDS = [
  // Security & safety
  "security",
  "safety",
  "incident",
  "emergency",
  "surveillance",
  "crowd management",
  "access control",
  "risk",
  // Technology
  "technology",
  "software",
  "platform",
  "digital",
  "data",
  "communications",
  "notification",
  "reporting",
  // Venue & events
  "venue",
  "operations",
  "event management",
  "spectator",
  // 911 / dispatch
  "911",
  "dispatch",
  "emergency communications",
  "public safety",
] as const;

/** Definitely not relevant — skip these. */
export const RAMP_EXCLUDE_KEYWORDS = [
  "food",
  "beverage",
  "catering",
  "cleaning",
  "janitorial",
  "landscaping",
  "floral",
  "apparel",
  "merchandise",
  "retail",
  "transportation",
  "shuttle",
  "bus",
  "taxi",
  "furniture",
  "printing",
  "signage only",
  "uniforms",
] as const;

/** Score contribution by solicitation type (fed into opportunity scorer × 3.5). */
export const RAMP_SIGNAL_SCORES: Record<string, number> = {
  RFP: 28, // → ~98 → ACT NOW + Teams via upsert threshold
  RFQ: 25, // → ~87 → ACT NOW
  ITB: 25,
  IFB: 25,
  EOI: 18, // early stage — Teams still fired explicitly by collector
  RFI: 15,
};

export type RampOppType = "RFP" | "RFQ" | "ITB" | "IFB" | "EOI" | "RFI" | "OTHER";

export function classifyRampType(raw: string | null | undefined): RampOppType {
  const t = (raw ?? "").toUpperCase();
  if (/\bRFP\b|REQUEST\s+FOR\s+PROPOSAL/.test(t)) return "RFP";
  if (/\bRFQ\b|REQUEST\s+FOR\s+QUOTE/.test(t)) return "RFQ";
  if (/\bITB\b|INVITATION\s+TO\s+BID/.test(t)) return "ITB";
  if (/\bIFB\b|INVITATION\s+FOR\s+BID/.test(t)) return "IFB";
  if (/\bEOI\b|EXPRESSION\s+OF\s+INTEREST/.test(t)) return "EOI";
  if (/\bRFI\b|REQUEST\s+FOR\s+INFORMATION/.test(t)) return "RFI";
  return "OTHER";
}

export function isRampRelevantText(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  if (RAMP_EXCLUDE_KEYWORDS.some((k) => text.includes(k))) return false;
  return RAMP_RELEVANT_KEYWORDS.some((k) => text.includes(k));
}
