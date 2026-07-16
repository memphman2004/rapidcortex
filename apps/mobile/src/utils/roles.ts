/**
 * Role gate for Venue/Campus mobile path.
 * Accepts product-vertical Cognito tokens (VENUE_*, CAMPUS_*), migrated snake_case
 * venue/campus roles, and RC internal operator roles.
 */
export function isVenueCampusRole(role: string): boolean {
  const trimmed = role.trim();
  if (!trimmed) return false;

  const upper = trimmed.toUpperCase();
  if (upper.startsWith('VENUE_') || upper.startsWith('CAMPUS_')) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower === 'rcadmin' ||
    lower === 'rcsuperadmin' ||
    lower === 'rcitadmin'
  ) {
    return true;
  }

  if (lower.startsWith('venue_') || lower.startsWith('campus_')) {
    return true;
  }

  return false;
}
