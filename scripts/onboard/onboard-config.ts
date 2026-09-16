/**
 * Parse / validate day-0 vertical onboarding env.
 * No AWS calls — unit-tested.
 */

export const ONBOARD_VERTICALS = ["campus", "venue", "transit", "hospital", "psap"] as const;
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

export type ExtraOnboardUser = {
  email: string;
  role: string;
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
  integrationMode: "none" | "demo_only" | "mock_adapters" | "live_transcript" | "cad_read_only";
  planId: string;
  dryRun: boolean;
  seedBilling: boolean;
  seedPlaceholderQr: boolean;
  extraUsers: ExtraOnboardUser[];
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
  }
}

export function productVertical(vertical: OnboardVertical): OnboardPlan["agencyVertical"] {
  return vertical === "psap" ? "core" : vertical;
}

export function adminProvisioning(vertical: OnboardVertical): { role: string; groups: string[] } {
  switch (vertical) {
    case "campus":
      return { role: "campus_admin", groups: ["campus_admin", "CAMPUS_ADMIN", "vertical_campus"] };
    case "venue":
      return { role: "venue_admin", groups: ["venue_admin", "vertical_venue"] };
    case "transit":
      return { role: "transit_admin", groups: ["TRANSIT_ADMIN", "vertical_transit"] };
    case "hospital":
      return { role: "hospitaladmin", groups: ["hospitaladmin", "vertical_hospital"] };
    case "psap":
      return { role: "agencyadmin", groups: ["agencyadmin", "vertical_911"] };
  }
}

export function groupsToEnsure(vertical: OnboardVertical): { name: string; description: string }[] {
  switch (vertical) {
    case "campus":
      return [
        { name: "campus_admin", description: "Campus safety administrator" },
        { name: "campus_supervisor", description: "Campus shift supervisor" },
        { name: "campus_security", description: "Campus security officer" },
        { name: "campus_dispatch", description: "Campus dispatch / comms" },
        { name: "CAMPUS_ADMIN", description: "Campus safety administrator" },
        { name: "CAMPUS_SUPERVISOR", description: "Campus shift supervisor" },
        { name: "CAMPUS_SECURITY", description: "Campus security officer" },
        { name: "CAMPUS_DISPATCH", description: "Campus dispatch / comms" },
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
  const verticalRaw = requireEnv(env, "VERTICAL").toLowerCase();
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
    vertical === "psap" ? `${state.toLowerCase()}-${slugPart(city)}-${slugPart(agencyName)}`.slice(0, 60) : `test-${vertical}-${orgCode.toLowerCase()}`,
  );

  const admin = adminProvisioning(vertical);
  const hospitalId =
    vertical === "hospital" ? optionalEnv(env, "HOSPITAL_ID", `hosp-${orgCode.toLowerCase()}`) : undefined;

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
    integrationMode: integrationRaw as OnboardPlan["integrationMode"],
    planId: optionalEnv(env, "PLAN_ID", "command"),
    dryRun: flag(env, "DRY_RUN"),
    seedBilling: flag(env, "SEED_BILLING"),
    seedPlaceholderQr: flag(env, "SEED_PLACEHOLDER_QR"),
    extraUsers: parseExtraUsers(env.EXTRA_USERS_JSON),
  };
}
