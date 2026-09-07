/**
 * Role gates for Venue / Campus mobile paths.
 * Accepts product-vertical Cognito tokens (VENUE_*, CAMPUS_*), migrated snake_case
 * venue/campus roles, compact/hyphen aliases, and RC internal operator roles.
 */

/** Cognito seed / legacy aliases → canonical snake_case. */
const ROLE_ALIASES: Record<string, string> = {
  campusadmin: 'campus_admin',
  campussecurity: 'campus_security',
  campussupervisor: 'campus_supervisor',
  campusdispatch: 'campus_security',
  'campus-admin': 'campus_admin',
  'campus-security': 'campus_security',
  'campus-supervisor': 'campus_supervisor',
  'campus-dispatch': 'campus_security',
  venueadmin: 'venue_admin',
  venuesecurity: 'venue_security',
  venuesupervisor: 'venue_supervisor',
  venueoperator: 'venue_operator',
  venueguest: 'venue_guest',
  venueguestservices: 'venue_guest',
  'venue-admin': 'venue_admin',
  'venue-security': 'venue_security',
  'venue-supervisor': 'venue_supervisor',
  'venue-operator': 'venue_operator',
  'venue-guest': 'venue_guest',
  'venue-guest-services': 'venue_guest',
  transitadmin: 'transit_admin',
  transitsupervisor: 'transit_supervisor',
  transitsecurity: 'transit_security',
  transitoperator: 'transit_operator',
  'transit-admin': 'transit_admin',
  'transit-supervisor': 'transit_supervisor',
  'transit-security': 'transit_security',
  'transit-operator': 'transit_operator',
  rc_admin: 'rcadmin',
  rc_superadmin: 'rcsuperadmin',
  rc_it_admin: 'rcitadmin',
  'rc-admin': 'rcadmin',
  'rc-superadmin': 'rcsuperadmin',
  'rc-it-admin': 'rcitadmin',
};

const SCREAMING_TO_SNAKE: Record<string, string> = {
  CAMPUS_ADMIN: 'campus_admin',
  CAMPUS_SUPERVISOR: 'campus_supervisor',
  CAMPUS_SECURITY: 'campus_security',
  CAMPUS_DISPATCH: 'campus_security',
  VENUE_ADMIN: 'venue_admin',
  VENUE_SUPERVISOR: 'venue_supervisor',
  VENUE_SECURITY: 'venue_security',
  VENUE_OPERATOR: 'venue_operator',
  VENUE_GUEST: 'venue_guest',
  VENUE_GUEST_SERVICES: 'venue_guest',
  TRANSIT_ADMIN: 'transit_admin',
  TRANSIT_SUPERVISOR: 'transit_supervisor',
  TRANSIT_SECURITY: 'transit_security',
  TRANSIT_OPERATOR: 'transit_operator',
  RCSUPERADMIN: 'rcsuperadmin',
  RCADMIN: 'rcadmin',
  RCITADMIN: 'rcitadmin',
};

/** Canonicalize JWT / Cognito role tokens for mobile gates. */
export function canonicalizeMobileRole(role: string | undefined | null): string {
  const raw = (role ?? '').trim();
  if (!raw) return '';

  const screaming = SCREAMING_TO_SNAKE[raw.toUpperCase()];
  if (screaming) return screaming;

  const aliased = ROLE_ALIASES[raw.toLowerCase()];
  if (aliased) return aliased;

  // Already snake_case product roles
  const lower = raw.toLowerCase().replace(/-/g, '_');
  if (lower.startsWith('venue_') || lower.startsWith('campus_') || lower.startsWith('transit_')) return lower;
  if (lower === 'rcsuperadmin' || lower === 'rcadmin' || lower === 'rcitadmin') return lower;

  return lower;
}

export function isRcInternalRole(role: string): boolean {
  const c = canonicalizeMobileRole(role);
  return c === 'rcadmin' || c === 'rcsuperadmin' || c === 'rcitadmin';
}

export function isVenueRole(role: string): boolean {
  const c = canonicalizeMobileRole(role);
  if (!c) return false;
  if (c.startsWith('venue_')) return true;
  return isRcInternalRole(role);
}

export function isCampusRole(role: string): boolean {
  const c = canonicalizeMobileRole(role);
  if (!c) return false;
  if (c.startsWith('campus_')) return true;
  return isRcInternalRole(role);
}

export function isTransitRole(role: string): boolean {
  const c = canonicalizeMobileRole(role);
  if (!c) return false;
  if (c.startsWith('transit_')) return true;
  return isRcInternalRole(role);
}

export function isVenueCampusRole(role: string): boolean {
  return isVenueRole(role) || isCampusRole(role) || isTransitRole(role);
}

/** Prefer the role's vertical; RC admins keep the product they selected. */
export function resolveFieldHome(
  role: string,
  preferred: 'venue' | 'campus' | null,
): '/(venue)' | '/(campus)' {
  const c = canonicalizeMobileRole(role);
  const isCampus = c.startsWith('campus_');
  const isVenue = c.startsWith('venue_');
  const isTransit = c.startsWith('transit_');

  if (isCampus && !isVenue) return '/(campus)';
  if ((isVenue || isTransit) && !isCampus) return '/(venue)';
  return preferred === 'campus' ? '/(campus)' : '/(venue)';
}
