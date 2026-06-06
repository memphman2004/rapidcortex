/**
 * Future: optional LLM pass that rewrites **only** protocol-approved dispatcher phrases
 * with calmer tone — must never add facts. For Phase 6 this is a no-op pass-through.
 */
export function humanizeApprovedPhraseStrict(approvedPhrase: string): string {
  const t = approvedPhrase.trim();
  if (t.length > 500) return `${t.slice(0, 497)}…`;
  return t;
}
