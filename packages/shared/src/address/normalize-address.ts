/** US-heavy abbreviations: fold common suffixes to one token. */
const ABBR: [RegExp, string][] = [
  [/\bstreet\b/g, "st"],
  [/\bavenue\b/g, "ave"],
  [/\broad\b/g, "rd"],
  [/\bdrive\b/g, "dr"],
  [/\bboulevard\b/g, "blvd"],
  [/\blane\b/g, "ln"],
  [/\bcourt\b/g, "ct"],
  [/\bplace\b/g, "pl"],
  [/\bcircle\b/g, "cir"],
  [/\bhighway\b/g, "hwy"],
  [/\bnorthwest\b/g, "nw"],
  [/\bnortheast\b/g, "ne"],
  [/\bsouthwest\b/g, "sw"],
  [/\bsoutheast\b/g, "se"],
  [/\bnorth\b/g, "n"],
  [/\bsouth\b/g, "s"],
  [/\beast\b/g, "e"],
  [/\bwest\b/g, "w"],
  [/#/g, " "],
];

/**
 * Normalize free-text address for Dynamo GSI lookups and cross-incident correlation.
 * - Lowercase, trim, collapse whitespace/punctuation
 * - Common US street type abbreviations
 */
export function normalizeAddressForIndex(input: string): string {
  let s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, rep] of ABBR) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, " ").trim().slice(0, 512);
}
