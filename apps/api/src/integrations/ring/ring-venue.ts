/** Extract venue code (e.g. MBS) from agency ids like `test-venue-mbs`. */
export function extractVenueCodeFromAgencyId(agencyId: string): string | null {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?venue-(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].toUpperCase().replace(/-/g, "");
}
