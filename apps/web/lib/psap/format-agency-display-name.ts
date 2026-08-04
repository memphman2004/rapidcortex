/** Humanize a jurisdiction slug when agency profile name is unavailable. */
export function formatJurisdictionAgencyName(
  jurisdiction: string,
  fallback = "Emergency Communications Center",
): string {
  const cleaned = jurisdiction.trim().replace(/[-_]+/g, " ");
  if (!cleaned) return fallback;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}
