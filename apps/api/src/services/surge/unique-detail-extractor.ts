/**
 * Given per-incident keyword lists, return short human-readable differentiators.
 */
export function extractUniqueDetails(perIncidentKeywords: Record<string, string[]>): string[] {
  const incidentIds = Object.keys(perIncidentKeywords);
  const out: string[] = [];
  for (const id of incidentIds) {
    const mine = new Set((perIncidentKeywords[id] ?? []).map((k) => k.toLowerCase()));
    const others = new Set<string>();
    for (const oid of incidentIds) {
      if (oid === id) continue;
      for (const k of perIncidentKeywords[oid] ?? []) others.add(k.toLowerCase());
    }
    const unique = [...mine].filter((k) => !others.has(k)).slice(0, 6);
    if (unique.length) {
      out.push(`${id.slice(0, 8)}…: ${unique.join(", ")}`);
    }
  }
  return out.slice(0, 12);
}
