/**
 * Role gates for Venue / Campus mobile paths.
 * Accepts product-vertical Cognito tokens (VENUE_*, CAMPUS_*), migrated snake_case
 * venue/campus roles, compact/hyphen aliases, and RC internal operator roles.
 */

/** Cognito seed / legacy aliases → canonical snake_case. */
const ROLE_ALIASES: Record<string, string> = {
  campusadmin: 'campus_admin_k12',
  campussecurity: 'campus_security_k12',
  campussupervisor: 'campus_supervisor_k12',
  campusdispatch: 'campus_dispatch_k12',
  'campus-admin': 'campus_admin_k12',
  'campus-security': 'campus_security_k12',
  'campus-supervisor': 'campus_supervisor_k12',
  'campus-dispatch': 'campus_dispatch_k12',
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
  // Campus product-suffixed Cognito groups (align with packages/shared).
  CAMPUS_ADMIN_K12: 'campus_admin_k12',
  CAMPUS_ADMIN_HIGHERED: 'campus_admin_highered',
  CAMPUS_SUPERVISOR_K12: 'campus_supervisor_k12',
  CAMPUS_SUPERVISOR_HIGHERED: 'campus_supervisor_highered',
  CAMPUS_SECURITY_K12: 'campus_security_k12',
  CAMPUS_SECURITY_HIGHERED: 'campus_security_highered',
  CAMPUS_DISPATCH_K12: 'campus_dispatch_k12',
  CAMPUS_DISPATCH_HIGHERED: 'campus_dispatch_highered',
  CAMPUS_COUNSELOR_K12: 'campus_counselor_k12',
  CAMPUS_COUNSELOR_HIGHERED: 'campus_counselor_highered',
  CAMPUS_FACULTY_K12: 'campus_faculty_k12',
  CAMPUS_FACULTY_HIGHERED: 'campus_faculty_highered',
  // Legacy unsuffixed campus → K-12.
  CAMPUS_ADMIN: 'campus_admin_k12',
  CAMPUS_SUPERVISOR: 'campus_supervisor_k12',
  CAMPUS_SECURITY: 'campus_security_k12',
  CAMPUS_DISPATCH: 'campus_dispatch_k12',
  CAMPUS_COUNSELOR: 'campus_counselor_k12',
  CAMPUS_FACULTY: 'campus_faculty_k12',
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

/** Strip `_k12` / `_highered` for product-agnostic capability checks. */
export function routingMobileRole(role: string | undefined | null): string {
  const c = canonicalizeMobileRole(role);
  if (c.endsWith('_highered')) return c.slice(0, -'_highered'.length);
  if (c.endsWith('_k12')) return c.slice(0, -'_k12'.length);
  return c;
}

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
  if (lower.startsWith('venue_') || lower.startsWith('campus_') || lower.startsWith('transit_')) {
    // Legacy unsuffixed campus snake_case → K-12 (matches shared migrate).
    switch (lower) {
      case 'campus_admin':
        return 'campus_admin_k12';
      case 'campus_supervisor':
        return 'campus_supervisor_k12';
      case 'campus_security':
        return 'campus_security_k12';
      case 'campus_dispatch':
        return 'campus_dispatch_k12';
      case 'campus_counselor':
        return 'campus_counselor_k12';
      case 'campus_faculty':
        return 'campus_faculty_k12';
      default:
        return lower;
    }
  }
  if (
    lower === 'rcsuperadmin' ||
    lower === 'rcadmin' ||
    lower === 'rcitadmin' ||
    lower === 'salescontractor'
  ) {
    return lower;
  }

  return lower;
}

export function isRcInternalRole(role: string): boolean {
  const c = canonicalizeMobileRole(role);
  return c === 'rcadmin' || c === 'rcsuperadmin' || c === 'rcitadmin' || c === 'salescontractor';
}

/** NexCort iQ staff (RC + sales) may program the NFC tag assigned to their own business card. */
export function canManageBusinessCardNfc(role: string): boolean {
  return isRcInternalRole(role);
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

/** Every signed-in account can open field Translator. */
export function canStartFieldTranslate(role: string): boolean {
  return Boolean(canonicalizeMobileRole(role));
}

export function isCommandRole(role: string): boolean {
  const c = canonicalizeMobileRole(role);
  if (!c) return false;
  if (isRcInternalRole(role)) return true;
  return (
    c === 'dispatcher' ||
    c === 'supervisor' ||
    c === 'agencyadmin' ||
    c === 'agencyit' ||
    c === 'analyst' ||
    c === 'auditor'
  );
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
