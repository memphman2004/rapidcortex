/**
 * Parse / validate day-0 vertical onboarding env.
 * No AWS calls — unit-tested.
 */

export const ONBOARD_VERTICALS = ["campus", "venue", "transit", "hospital", "psap", "call_assist"] as const;
export type OnboardVertical = (typeof ONBOARD_VERTICALS)[number];

const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
]);

const AGENCY_TYPES = [
  "city",
  "county",
  "municipality",
  "regional_center",
  "pilot",
  "state_agency",
  "venue",
  "campus",
  "transit",
] as const;

export type AgencyTypeValue = (typeof AGENCY_TYPES)[number];

export type CampusInstitutionType = "k12" | "highered";

export type ExtraOnboardUser = {
  email: string;
  role: string;
};

/**
 * Optional seat emails for the ordered day-one seat pack.
 * Each key corresponds to an env var (e.g. SUPERVISOR_EMAIL).
 * Empty string = that seat is not provisioned today.
 */
export type SeatEmails = {
  supervisorEmail: string;
  agencyItEmail: string;
  dispatcherEmail: string;
  analystEmail: string;
  auditorEmail: string;
  securityEmail: string;
  operatorEmail: string;
  guestEmail: string;
  coordinatorEmail: string;
  staffEmail: string;
};

export type OnboardPlan = {
  vertical: OnboardVertical;
  agencyId: string;
  agencyName: string;
  agencyType: AgencyTypeValue;
  agencyVertical: "core" | "campus" | "venue" | "hospital" | "transit";
  state: string;
  city: string;
  region: string;
  timezone: string;
  primaryContactName: string;
  primaryContactEmail: string;
  adminEmail: string;
  adminRole: string;
  adminGroups: string[];
  orgCode: string;
  hospitalId?: string;
  institutionType: CampusInstitutionType;
  seatEmails: SeatEmails;
  integrationMode: "none" | "demo_only" | "mock_adapters" | "live_transcript" | "cad_read_only";
  planId: string;
  dryRun: boolean;
  seedBilling: boolean;
  seedPlaceholderQr: boolean;
  extraUsers: ExtraOnboardUser[];
};

/** A single ordered day-one Cognito seat. */
export type DayOneSeat = {
  /** Name of the env var that holds this seat's email (for diagnostics). */
  emailEnvKey: string;
  /** Resolved email address. Empty string means skip this seat. */
  email: string;
  /** JWT custom:role value. */
  role: string;
  /** Cognito groups to add this user to. */
  groups: string[];
};

export function isOnboardVertical(raw: string): raw is OnboardVertical {
  return (ONBOARD_VERTICALS as readonly string[]).includes(raw);
}

export function isValidOnboardPassword(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function requireEnv(env: NodeJS.Dict<string>, name: string): string {
  const v = env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optionalEnv(env: NodeJS.Dict<string>, name: string, fallback: string): string {
  const v = env[name]?.trim();
  return v || fallback;
}

function optionalEmail(env: NodeJS.Dict<string>, name: string): string {
  const v = env[name]?.trim().toLowerCase() ?? "";
  if (v && !v.includes("@")) throw new Error(`${name} must be an email address`);
  return v;
}

function flag(env: NodeJS.Dict<string>, name: string): boolean {
  const v = (env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function slugPart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function defaultAgencyType(vertical: OnboardVertical): AgencyTypeValue {
  switch (vertical) {
    case "campus":
      return "campus";
    case "venue":
      return "venue";
    case "transit":
      return "transit";
    case "hospital":
      return "municipality";
    case "psap":
      return "city";
    case "call_assist":
      return "municipality";
  }
}

export function productVertical(vertical: OnboardVertical): OnboardPlan["agencyVertical"] {
  if (vertical === "psap" || vertical === "call_assist") return "core";
  return vertical as "campus" | "venue" | "hospital" | "transit";
}

export function adminProvisioning(
  vertical: OnboardVertical,
  institutionType: CampusInstitutionType = "highered",
): { role: string; groups: string[] } {
  switch (vertical) {
    case "campus": {
      const suffix = institutionType.toUpperCase();
      return {
        role: `campus_admin_${institutionType}`,
        groups: [`CAMPUS_ADMIN_${suffix}`, "vertical_campus"],
      };
    }
    case "venue":
      return { role: "venue_admin", groups: ["venue_admin", "vertical_venue"] };
    case "transit":
      return { role: "transit_admin", groups: ["TRANSIT_ADMIN", "vertical_transit"] };
    case "hospital":
      return { role: "hospitaladmin", groups: ["hospitaladmin", "vertical_hospital"] };
    case "psap":
      return { role: "agencyadmin", groups: ["agencyadmin", "vertical_911"] };
    case "call_assist":
      return { role: "call_assist_admin", groups: ["CALL_ASSIST_ADMIN", "vertical_call_assist"] };
  }
}

export function groupsToEnsure(vertical: OnboardVertical): { name: string; description: string }[] {
  switch (vertical) {
    case "campus":
      return [
        { name: "CAMPUS_ADMIN_K12", description: "Campus safety administrator (K-12)" },
        { name: "CAMPUS_SUPERVISOR_K12", description: "Campus shift supervisor (K-12)" },
        { name: "CAMPUS_SECURITY_K12", description: "Campus security officer (K-12)" },
        { name: "CAMPUS_DISPATCH_K12", description: "Campus dispatch / comms (K-12)" },
        { name: "CAMPUS_COUNSELOR_K12", description: "Campus counselor (K-12)" },
        { name: "CAMPUS_FACULTY_K12", description: "Campus faculty (K-12)" },
        { name: "CAMPUS_ADMIN_HIGHERED", description: "Campus safety administrator (Higher-ed)" },
        { name: "CAMPUS_SUPERVISOR_HIGHERED", description: "Campus shift supervisor (Higher-ed)" },
        { name: "CAMPUS_SECURITY_HIGHERED", description: "Campus security officer (Higher-ed)" },
        { name: "CAMPUS_DISPATCH_HIGHERED", description: "Campus dispatch / comms (Higher-ed)" },
        { name: "CAMPUS_COUNSELOR_HIGHERED", description: "Campus counselor (Higher-ed)" },
        { name: "CAMPUS_FACULTY_HIGHERED", description: "Campus faculty (Higher-ed)" },
        { name: "CAMPUS_ADMIN", description: "Legacy campus admin (aliases to K-12)" },
        { name: "CAMPUS_SUPERVISOR", description: "Legacy campus supervisor (aliases to K-12)" },
        { name: "CAMPUS_SECURITY", description: "Legacy campus security (aliases to K-12)" },
        { name: "CAMPUS_DISPATCH", description: "Legacy campus dispatch (aliases to K-12)" },
        { name: "vertical_campus", description: "Campus safety vertical" },
      ];
    case "venue":
      return [
        { name: "venue_admin", description: "Venue safety administrator" },
        { name: "venue_supervisor", description: "Venue supervisor" },
        { name: "venue_security", description: "Venue security" },
        { name: "venue_operator", description: "Venue operator" },
        { name: "venue_guest_services", description: "Venue guest services" },
        { name: "vertical_venue", description: "Venue operations vertical" },
      ];
    case "transit":
      return [
        { name: "TRANSIT_ADMIN", description: "Transit authority administrator" },
        { name: "TRANSIT_SUPERVISOR", description: "Transit operations supervisor" },
        { name: "TRANSIT_SECURITY", description: "Transit security" },
        { name: "TRANSIT_OPERATOR", description: "Transit vehicle operator" },
        { name: "vertical_transit", description: "Transit operations vertical" },
      ];
    case "hospital":
      return [
        { name: "hospitaladmin", description: "Hospital facility administrator" },
        { name: "hospital_coord", description: "Hospital emergency coordinator" },
        { name: "hospitalstaff", description: "Hospital staff capacity updates" },
        { name: "vertical_hospital", description: "Hospital routing vertical" },
      ];
    case "psap":
      return [
        { name: "agencyadmin", description: "Agency administrator" },
        { name: "dispatcher", description: "Dispatcher" },
        { name: "supervisor", description: "Supervisor" },
        { name: "agencyit", description: "Agency IT" },
        { name: "analyst", description: "Analyst" },
        { name: "auditor", description: "Auditor" },
        { name: "vertical_911", description: "911 PSAP vertical" },
      ];
    case "call_assist":
      return [
        { name: "CALL_ASSIST_ADMIN", description: "Nexiq administrator" },
        { name: "CALL_ASSIST_SUPERVISOR", description: "Nexiq supervisor" },
        { name: "CALL_ASSIST_OPERATOR", description: "Nexiq operator" },
        { name: "vertical_call_assist", description: "Nexiq non-emergency vertical" },
      ];
  }
}

/**
 * Ordered day-one seat pack for the given plan.
 * Admin is always seat #1. Floor roles follow admin → supervisor → floor.
 * Seats with an empty email are skipped — they can be added later via EXTRA_USERS_JSON.
 */
export function dayOneSeats(plan: OnboardPlan): DayOneSeat[] {
  const { seatEmails: se, institutionType: inst } = plan;

  switch (plan.vertical) {
    case "psap":
      return [
        { emailEnvKey: "ADMIN_EMAIL", email: plan.adminEmail, role: "agencyadmin", groups: ["agencyadmin", "vertical_911"] },
        { emailEnvKey: "AGENCY_IT_EMAIL", email: se.agencyItEmail, role: "agencyit", groups: ["agencyit", "vertical_911"] },
        { emailEnvKey: "SUPERVISOR_EMAIL", email: se.supervisorEmail, role: "supervisor", groups: ["supervisor", "vertical_911"] },
        { emailEnvKey: "DISPATCHER_EMAIL", email: se.dispatcherEmail, role: "dispatcher", groups: ["dispatcher", "vertical_911"] },
        { emailEnvKey: "ANALYST_EMAIL", email: se.analystEmail, role: "analyst", groups: ["analyst", "vertical_911"] },
        { emailEnvKey: "AUDITOR_EMAIL", email: se.auditorEmail, role: "auditor", groups: ["auditor", "vertical_911"] },
      ];

    case "campus": {
      const sfx = inst.toUpperCase();
      return [
        { emailEnvKey: "ADMIN_EMAIL", email: plan.adminEmail, role: `campus_admin_${inst}`, groups: [`CAMPUS_ADMIN_${sfx}`, "vertical_campus"] },
        { emailEnvKey: "SUPERVISOR_EMAIL", email: se.supervisorEmail, role: `campus_supervisor_${inst}`, groups: [`CAMPUS_SUPERVISOR_${sfx}`, "vertical_campus"] },
        { emailEnvKey: "SECURITY_EMAIL", email: se.securityEmail, role: `campus_security_${inst}`, groups: [`CAMPUS_SECURITY_${sfx}`, "vertical_campus"] },
        { emailEnvKey: "DISPATCH_EMAIL", email: se.dispatcherEmail, role: `campus_dispatch_${inst}`, groups: [`CAMPUS_DISPATCH_${sfx}`, "vertical_campus"] },
      ];
    }

    case "venue":
      return [
        { emailEnvKey: "ADMIN_EMAIL", email: plan.adminEmail, role: "venue_admin", groups: ["venue_admin", "vertical_venue"] },
        { emailEnvKey: "SUPERVISOR_EMAIL", email: se.supervisorEmail, role: "venue_supervisor", groups: ["venue_supervisor", "vertical_venue"] },
        { emailEnvKey: "SECURITY_EMAIL", email: se.securityEmail, role: "venue_security", groups: ["venue_security", "vertical_venue"] },
        { emailEnvKey: "OPERATOR_EMAIL", email: se.operatorEmail, role: "venue_operator", groups: ["venue_operator", "vertical_venue"] },
        { emailEnvKey: "GUEST_EMAIL", email: se.guestEmail, role: "venue_guest", groups: ["venue_guest_services", "vertical_venue"] },
      ];

    case "transit":
      return [
        { emailEnvKey: "ADMIN_EMAIL", email: plan.adminEmail, role: "transit_admin", groups: ["TRANSIT_ADMIN", "vertical_transit"] },
        { emailEnvKey: "SUPERVISOR_EMAIL", email: se.supervisorEmail, role: "transit_supervisor", groups: ["TRANSIT_SUPERVISOR", "vertical_transit"] },
        { emailEnvKey: "SECURITY_EMAIL", email: se.securityEmail, role: "transit_security", groups: ["TRANSIT_SECURITY", "vertical_transit"] },
        { emailEnvKey: "OPERATOR_EMAIL", email: se.operatorEmail, role: "transit_operator", groups: ["TRANSIT_OPERATOR", "vertical_transit"] },
      ];

    case "hospital":
      return [
        { emailEnvKey: "ADMIN_EMAIL", email: plan.adminEmail, role: "hospitaladmin", groups: ["hospitaladmin", "vertical_hospital"] },
        { emailEnvKey: "COORDINATOR_EMAIL", email: se.coordinatorEmail, role: "hospital_coord", groups: ["hospital_coord", "vertical_hospital"] },
        { emailEnvKey: "STAFF_EMAIL", email: se.staffEmail, role: "hospitalstaff", groups: ["hospitalstaff", "vertical_hospital"] },
      ];

    case "call_assist":
      return [
        { emailEnvKey: "ADMIN_EMAIL", email: plan.adminEmail, role: "call_assist_admin", groups: ["CALL_ASSIST_ADMIN", "vertical_call_assist"] },
        { emailEnvKey: "SUPERVISOR_EMAIL", email: se.supervisorEmail, role: "call_assist_supervisor", groups: ["CALL_ASSIST_SUPERVISOR", "vertical_call_assist"] },
        { emailEnvKey: "OPERATOR_EMAIL", email: se.operatorEmail, role: "call_assist_operator", groups: ["CALL_ASSIST_OPERATOR", "vertical_call_assist"] },
      ];
  }
}

function parseExtraUsers(raw: string | undefined): ExtraOnboardUser[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("EXTRA_USERS_JSON must be JSON array of {email, role}");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("EXTRA_USERS_JSON must be a JSON array");
  }
  return parsed.map((row, i) => {
    if (!row || typeof row !== "object") {
      throw new Error(`EXTRA_USERS_JSON[${i}] must be an object`);
    }
    const email = String((row as { email?: unknown }).email ?? "").trim().toLowerCase();
    const role = String((row as { role?: unknown }).role ?? "").trim();
    if (!email.includes("@") || !role) {
      throw new Error(`EXTRA_USERS_JSON[${i}] needs email and role`);
    }
    return { email, role };
  });
}

export function parseOnboardEnv(env: NodeJS.Dict<string> = process.env): OnboardPlan {
  const verticalRaw = requireEnv(env, "VERTICAL").toLowerCase().replace(/-/g, "_");
  if (!isOnboardVertical(verticalRaw)) {
    throw new Error(`VERTICAL must be one of ${ONBOARD_VERTICALS.join(", ")}`);
  }
  const vertical = verticalRaw;

  const agencyName = requireEnv(env, "AGENCY_NAME");
  const state = requireEnv(env, "STATE").toUpperCase();
  if (!US_STATES.has(state)) {
    throw new Error(`STATE must be a 2-letter US code (got ${state})`);
  }
  const city = requireEnv(env, "CITY");
  const adminEmail = requireEnv(env, "ADMIN_EMAIL").toLowerCase();
  if (!adminEmail.includes("@")) throw new Error("ADMIN_EMAIL must be an email");

  const integrationRaw = optionalEnv(env, "INTEGRATION_MODE", "mock_adapters");
  if (integrationRaw === "bidirectional") {
    throw new Error("CAD write-back is fail-closed. Do not set INTEGRATION_MODE=bidirectional.");
  }
  const allowedModes = ["none", "demo_only", "mock_adapters", "live_transcript", "cad_read_only"] as const;
  if (!(allowedModes as readonly string[]).includes(integrationRaw)) {
    throw new Error(`INTEGRATION_MODE must be one of ${allowedModes.join(", ")}`);
  }

  const typeRaw = optionalEnv(env, "AGENCY_TYPE", defaultAgencyType(vertical));
  if (!(AGENCY_TYPES as readonly string[]).includes(typeRaw)) {
    throw new Error(`AGENCY_TYPE must be one of ${AGENCY_TYPES.join(", ")}`);
  }

  const orgDefault =
    vertical === "psap" ? slugPart(`${state}-${city}`) : slugPart(optionalEnv(env, "ORG_CODE", city));
  const orgCode = optionalEnv(env, "ORG_CODE", orgDefault).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (orgCode.length < 2) throw new Error("ORG_CODE must be at least 2 letters/digits");

  const agencyId = optionalEnv(
    env,
    "AGENCY_ID",
    vertical === "psap"
      ? `${state.toLowerCase()}-${slugPart(city)}-${slugPart(agencyName)}`.slice(0, 60)
      : `test-${vertical.replace(/_/g, "-")}-${orgCode.toLowerCase()}`,
  );

  // Campus institution type — determines role suffix (k12 / highered)
  const rawInst = optionalEnv(env, "CAMPUS_INSTITUTION_TYPE", "highered").toLowerCase();
  if (rawInst !== "k12" && rawInst !== "highered") {
    throw new Error("CAMPUS_INSTITUTION_TYPE must be k12 or highered");
  }
  const institutionType: CampusInstitutionType = rawInst as CampusInstitutionType;

  const admin = adminProvisioning(vertical, institutionType);
  const hospitalId =
    vertical === "hospital"
      ? optionalEnv(env, "HOSPITAL_ID", `hosp-${orgCode.toLowerCase()}`)
      : undefined;

  const seatEmails: SeatEmails = {
    supervisorEmail: optionalEmail(env, "SUPERVISOR_EMAIL"),
    agencyItEmail: optionalEmail(env, "AGENCY_IT_EMAIL"),
    dispatcherEmail: optionalEmail(env, "DISPATCHER_EMAIL"),
    analystEmail: optionalEmail(env, "ANALYST_EMAIL"),
    auditorEmail: optionalEmail(env, "AUDITOR_EMAIL"),
    securityEmail: optionalEmail(env, "SECURITY_EMAIL"),
    operatorEmail: optionalEmail(env, "OPERATOR_EMAIL"),
    guestEmail: optionalEmail(env, "GUEST_EMAIL"),
    coordinatorEmail: optionalEmail(env, "COORDINATOR_EMAIL"),
    staffEmail: optionalEmail(env, "STAFF_EMAIL"),
  };

  return {
    vertical,
    agencyId,
    agencyName,
    agencyType: typeRaw as AgencyTypeValue,
    agencyVertical: productVertical(vertical),
    state,
    city,
    region: optionalEnv(env, "REGION_NAME", "Unspecified"),
    timezone: optionalEnv(env, "TIMEZONE", "America/New_York"),
    primaryContactName: optionalEnv(env, "PRIMARY_CONTACT_NAME", "Agency Admin"),
    primaryContactEmail: optionalEnv(env, "PRIMARY_CONTACT_EMAIL", adminEmail),
    adminEmail,
    adminRole: admin.role,
    adminGroups: admin.groups,
    orgCode,
    hospitalId,
    institutionType,
    seatEmails,
    integrationMode: integrationRaw as OnboardPlan["integrationMode"],
    planId: optionalEnv(env, "PLAN_ID", "command"),
    dryRun: flag(env, "DRY_RUN"),
    seedBilling: flag(env, "SEED_BILLING"),
    seedPlaceholderQr: flag(env, "SEED_PLACEHOLDER_QR"),
    extraUsers: parseExtraUsers(env.EXTRA_USERS_JSON),
  };
}
