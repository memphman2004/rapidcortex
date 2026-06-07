/** Venue product roles — distinct from PSAP dispatcher/supervisor dashboards. */
export type VenueRole =
  | "VENUE_ADMIN"
  | "VENUE_SUPERVISOR"
  | "VENUE_SECURITY"
  | "VENUE_OPERATOR"
  | "VENUE_GUEST_SERVICES";

export type VenueDashboardSections = {
  /** Dispatcher-style ops stat grid (open/responding/resolved). */
  opsStats: boolean;
  staffAvailableStat: boolean;
  activeIncidentsTable: boolean;
  guestReportsFeed: boolean;
  staffStatusPanel: boolean;
  cameraHealth: boolean;
};

const FULL_OPS: VenueDashboardSections = {
  opsStats: true,
  staffAvailableStat: true,
  activeIncidentsTable: true,
  guestReportsFeed: true,
  staffStatusPanel: true,
  cameraHealth: true,
};

const SECTIONS_BY_ROLE: Record<VenueRole, VenueDashboardSections> = {
  VENUE_ADMIN: FULL_OPS,
  VENUE_SUPERVISOR: FULL_OPS,
  VENUE_SECURITY: {
    opsStats: true,
    staffAvailableStat: false,
    activeIncidentsTable: true,
    guestReportsFeed: true,
    staffStatusPanel: true,
    cameraHealth: true,
  },
  VENUE_OPERATOR: {
    opsStats: true,
    staffAvailableStat: false,
    activeIncidentsTable: true,
    guestReportsFeed: false,
    staffStatusPanel: false,
    cameraHealth: false,
  },
  VENUE_GUEST_SERVICES: {
    opsStats: false,
    staffAvailableStat: false,
    activeIncidentsTable: false,
    guestReportsFeed: true,
    staffStatusPanel: false,
    cameraHealth: false,
  },
};

export function normalizeVenueRole(role: string | undefined | null): VenueRole {
  const upper = (role ?? "").trim().toUpperCase();
  if (upper in SECTIONS_BY_ROLE) return upper as VenueRole;
  return "VENUE_SUPERVISOR";
}

export function getVenueDashboardSections(role: string | undefined | null): VenueDashboardSections {
  return SECTIONS_BY_ROLE[normalizeVenueRole(role)];
}

export function getVenueDashboardTitle(role: string | undefined | null): string {
  switch (normalizeVenueRole(role)) {
    case "VENUE_GUEST_SERVICES":
      return "Guest report intake";
    case "VENUE_OPERATOR":
      return "Venue response queue";
    case "VENUE_SECURITY":
      return "Security operations";
    case "VENUE_ADMIN":
      return "Venue command center";
    default:
      return "Venue operations";
  }
}

export function getVenueDashboardSubtitle(role: string | undefined | null): string {
  switch (normalizeVenueRole(role)) {
    case "VENUE_GUEST_SERVICES":
      return "Track QR and SMS guest reports. This is not a 911 dispatch console.";
    case "VENUE_OPERATOR":
      return "Acknowledge and update venue incidents in your assigned zones.";
    case "VENUE_SECURITY":
      return "Monitor active incidents, guest reports, staff, and camera health.";
    case "VENUE_ADMIN":
      return "Full venue configuration, analytics, and game-day operations.";
    default:
      return "Coordinate venue safety, guest reports, and on-site response.";
  }
}
