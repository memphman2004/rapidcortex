/**
 * Role gates for Venue / Campus mobile paths.
 * Accepts product-vertical Cognito tokens (VENUE_*, CAMPUS_*), migrated snake_case
 * venue/campus roles, and RC internal operator roles.
 */

function normalizeRole(role: string): { upper: string; lower: string } {
  const trimmed = role.trim();
  return { upper: trimmed.toUpperCase(), lower: trimmed.toLowerCase() };
}

export function isRcInternalRole(role: string): boolean {
  const { lower } = normalizeRole(role);
  return lower === 'rcadmin' || lower === 'rcsuperadmin' || lower === 'rcitadmin';
}

export function isVenueRole(role: string): boolean {
  const { upper, lower } = normalizeRole(role);
  if (!upper) return false;
  if (upper.startsWith('VENUE_') || lower.startsWith('venue_')) return true;
  return isRcInternalRole(role);
}

export function isCampusRole(role: string): boolean {
  const { upper, lower } = normalizeRole(role);
  if (!upper) return false;
  if (upper.startsWith('CAMPUS_') || lower.startsWith('campus_')) return true;
  return isRcInternalRole(role);
}

export function isVenueCampusRole(role: string): boolean {
  const { upper, lower } = normalizeRole(role);
  if (!upper) return false;
  if (upper.startsWith('VENUE_') || upper.startsWith('CAMPUS_')) return true;
  if (lower.startsWith('venue_') || lower.startsWith('campus_')) return true;
  return isRcInternalRole(role);
}

/** Prefer the role's vertical; RC admins keep the product they selected. */
export function resolveFieldHome(
  role: string,
  preferred: 'venue' | 'campus' | null,
): '/(venue)' | '/(campus)' {
  const { upper, lower } = normalizeRole(role);
  const isCampus =
    upper.startsWith('CAMPUS_') || lower.startsWith('campus_');
  const isVenue =
    upper.startsWith('VENUE_') || lower.startsWith('venue_');

  if (isCampus && !isVenue) return '/(campus)';
  if (isVenue && !isCampus) return '/(venue)';
  return preferred === 'campus' ? '/(campus)' : '/(venue)';
}
