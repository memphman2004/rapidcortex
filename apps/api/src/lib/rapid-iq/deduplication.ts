/** Stable opportunity key from agency + state for upsert dedupe. */
export function opportunityDedupeKey(agencyName: string, state: string): string {
  const slug = agencyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `opp#${String(state).toUpperCase()}#${slug}`;
}

export function signalDedupeKey(opportunityId: string, sourceUrl: string, title: string): string {
  const t = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
  const u = sourceUrl.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-32);
  return `sig#${opportunityId}#${u}#${t}`;
}
