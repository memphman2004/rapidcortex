/** Derive campus org code from tenant agencyId (e.g. test-campus-uga → UGA). */
export function campusCodeFromAgencyId(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?campus-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

/** Derive venue org code from tenant agencyId (e.g. test-venue-mbs → MBS). */
export function venueCodeFromAgencyId(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?venue-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
