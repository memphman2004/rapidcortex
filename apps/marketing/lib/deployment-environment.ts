/** Demo tenant slug for marketing dashboard deep links (static site only). */
export function demoJurisdictionSlug(): string {
  return process.env.NEXT_PUBLIC_DEMO_JURISDICTION_SLUG?.trim() || "columbus-state";
}

export function isDemoJurisdictionSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === demoJurisdictionSlug().toLowerCase();
}
