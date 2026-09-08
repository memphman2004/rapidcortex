import { z } from "zod";
import { resolveAgencyVerticalFromTenant, type AgencyType, type AgencyVertical } from "../tenancy/agency.js";
import { getUserRoleDisplayLabel } from "../auth/role-display.js";
import type { RapidCortexRole } from "../auth/rapid-cortex-roles.js";
import type { CadProviderId } from "./cad-types.js";
import type { CallIntakeData } from "./intake.js";
import type { RetentionPolicy } from "./retention.js";

export const CALL_ASSIST_UI_VERTICALS = ["911", "campus", "venue"] as const;
export type CallAssistUiVertical = (typeof CALL_ASSIST_UI_VERTICALS)[number];

export const CALL_ASSIST_MONITOR_STATES = ["ai_active", "transfer_911", "external", "done"] as const;
export type CallAssistMonitorState = (typeof CALL_ASSIST_MONITOR_STATES)[number];

export const CALL_ASSIST_CLASS_BADGES = ["EMERGENCY", "NON_EMERGENCY", "SELF_SERVICE"] as const;
export type CallAssistClassBadge = (typeof CALL_ASSIST_CLASS_BADGES)[number];

/** Live CAD vendors show a label; mock (and unknown) hide the CAD block. */
export const CAD_PROVIDER_UI_LABELS: Record<CadProviderId, string | null> = {
  mock: null,
  "motorola-premierone": "PremierOne",
  "tyler-new-world": "New World CAD",
  mark43: "Mark43",
  "hexagon-intergraph": "Hexagon",
  versaterm: "Versaterm",
  centralsquare: "CentralSquare",
  zetron: "Zetron",
};

export type CallAssistVerticalLabels = {
  callerIdLabel: string;
  locationLabel: string;
  escalationLabel: string;
  transferTarget: string;
  statLabel2: string;
  alertSub: string;
  officerSafetyFlag: string;
  userRoleFallback: string;
};

export const CALL_ASSIST_VERTICAL_LABELS: Record<CallAssistUiVertical, CallAssistVerticalLabels> = {
  "911": {
    callerIdLabel: "ANI",
    locationLabel: "Address",
    escalationLabel: "Emergency transfer",
    transferTarget: "dispatcher",
    statLabel2: "Emergency transfers",
    alertSub: "Safety threshold crossed mid-call. AI has stopped. Caller is holding.",
    officerSafetyFlag: "Officer safety alert on file",
    userRoleFallback: "Dispatcher",
  },
  campus: {
    callerIdLabel: "Caller",
    locationLabel: "Building & room",
    escalationLabel: "Emergency escalation",
    transferTarget: "staff",
    statLabel2: "Emergency escalations",
    alertSub: "Emergency threshold reached. Caller is holding. Campus police and health services have been alerted.",
    officerSafetyFlag: "Location safety alert on file",
    userRoleFallback: "Staff",
  },
  venue: {
    callerIdLabel: "Guest",
    locationLabel: "Section / row",
    escalationLabel: "Emergency escalation",
    transferTarget: "security",
    statLabel2: "Emergency escalations",
    alertSub: "Emergency threshold reached. AI has stopped. Security ops and medical have been notified.",
    officerSafetyFlag: "Location safety alert on file",
    userRoleFallback: "Operator",
  },
};

export const callAssistUiDirectoryEntrySchema = z.object({
  externalAgencyId: z.string().min(1),
  name: z.string().min(1),
  number: z.string().min(1),
});

export const callAssistUiCapabilitiesSchema = z.object({
  takeover: z.boolean(),
  cadPush: z.boolean(),
  forceTransfer: z.boolean(),
  admin: z.boolean(),
  records: z.boolean(),
  demo: z.boolean(),
  analytics: z.boolean(),
});

export const callAssistUiProfileSchema = z.object({
  agencyId: z.string().min(1),
  shortName: z.string().min(1),
  shiftLabel: z.string(),
  vertical: z.enum(CALL_ASSIST_UI_VERTICALS),
  userRole: z.string().min(1),
  userName: z.string().min(1),
  userInitials: z.string().min(1).max(4),
  cadProvider: z.string().min(1).nullable(),
  callerIdLabel: z.string().min(1),
  locationLabel: z.string().min(1),
  escalationLabel: z.string().min(1),
  transferTarget: z.string().min(1),
  statLabel2: z.string().min(1),
  alertSub: z.string().min(1),
  alertPickupLine: z.string().nullable(),
  officerSafetyFlag: z.string().min(1),
  retentionLabel: z.string().min(1),
  cadNatureMapping: z.record(z.string(), z.string()),
  classificationLabels: z.record(z.string(), z.string()),
  onboardingComplete: z.boolean(),
  disclosureText: z.string(),
  governingLaw: z.string().nullable(),
  externalDirectory: z.array(callAssistUiDirectoryEntrySchema),
  capabilities: callAssistUiCapabilitiesSchema,
});
export type CallAssistUiProfile = z.infer<typeof callAssistUiProfileSchema>;
export type CallAssistUiCapabilities = z.infer<typeof callAssistUiCapabilitiesSchema>;
export type CallAssistUiDirectoryEntry = z.infer<typeof callAssistUiDirectoryEntrySchema>;

export function cadProviderUiLabel(id: CadProviderId | string | null | undefined): string | null {
  if (!id) return null;
  if (id in CAD_PROVIDER_UI_LABELS) {
    return CAD_PROVIDER_UI_LABELS[id as CadProviderId];
  }
  return null;
}

/** Hide CAD push when the tenant chose No CAD (`cadProviderLabel: null`). */
export function resolveCadPushLabel(
  cadProviderId?: CadProviderId | string | null,
  cadProviderLabel?: string | null,
): string | null {
  if (cadProviderLabel === null) return null;
  const explicit = cadProviderLabel?.trim();
  if (explicit) return explicit;
  return cadProviderUiLabel(cadProviderId);
}

export function callAssistUiVerticalFromAgency(input: {
  type?: string | null;
  vertical?: string | null;
  agencyId?: string | null;
  uiVertical?: string | null;
}): CallAssistUiVertical {
  const override = input.uiVertical?.trim();
  if (override === "911" || override === "campus" || override === "venue") return override;
  const resolved = resolveAgencyVerticalFromTenant({
    agencyId: input.agencyId?.trim() || "unknown",
    type: (input.type as AgencyType) || "city",
    vertical: input.vertical as AgencyVertical | undefined,
  });
  if (resolved === "campus") return "campus";
  if (resolved === "venue" || resolved === "transit") return "venue";
  return "911";
}

export function callAssistEmergencyAlertTitle(
  vertical: CallAssistUiVertical,
  pickupLine?: string | null,
): string {
  const label = CALL_ASSIST_VERTICAL_LABELS[vertical].escalationLabel;
  const line = pickupLine?.trim();
  if (vertical === "911" && line) return `${label} in progress — pick up ${line}`;
  return `${label} in progress`;
}

export function callAssistUserDisplayName(opts: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const name = opts.displayName?.trim();
  if (name) return name;
  const email = opts.email?.trim();
  if (email) return email.split("@")[0] || email;
  return "Operator";
}

export function callAssistUserInitials(name: string): string {
  const parts = name
    .replace(/[._]/g, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[parts.length - 1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  const compact = name.replace(/[^A-Za-z0-9]/g, "");
  return (compact.slice(0, 2) || "RC").toUpperCase();
}

export function callAssistDisplayRole(opts: {
  vertical: CallAssistUiVertical;
  role: string;
}): string {
  if (opts.vertical !== "911") return CALL_ASSIST_VERTICAL_LABELS[opts.vertical].userRoleFallback;
  return getUserRoleDisplayLabel(opts.role as RapidCortexRole);
}

export function formatRetentionPolicyLabel(policy: RetentionPolicy | null | undefined): string {
  if (!policy) return "Agency retention policy";
  const law = policy.governingLaw?.trim();
  if (law) return law;
  const named = policy.policyName?.trim() || policy.displayName?.trim();
  if (named) return named;
  if (policy.statute?.trim()) return `${policy.jurisdiction} ${policy.statute}`.trim();
  return "Agency retention policy";
}

export function mapCallAssistMonitorState(state: string): CallAssistMonitorState {
  if (state === "TRANSFERRING_911") return "transfer_911";
  if (
    state === "TRANSFERRING_EXTERNAL" ||
    state === "TRANSFERRING_HUMAN" ||
    state === "CALLBACK_IN_PROGRESS" ||
    state === "CALLBACK_QUEUED"
  ) {
    return "external";
  }
  if (state === "COMPLETED" || state === "FAILED" || state === "SURVEY") return "done";
  return "ai_active";
}

export function mapCallAssistClassBadge(classification?: string | null): CallAssistClassBadge {
  if (classification === "EMERGENCY") return "EMERGENCY";
  if (
    classification === "CARFAX_REPORTING_ELIGIBLE" ||
    classification === "ONLINE_REPORTING_ELIGIBLE" ||
    classification === "INFORMATION_REQUEST"
  ) {
    return "SELF_SERVICE";
  }
  return "NON_EMERGENCY";
}

export function humanizeCallAssistToken(value?: string | null): string {
  if (!value?.trim()) return "Unknown";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatMaskedAni(last4?: string | null): string {
  const digits = String(last4 ?? "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? `●●●● ${digits}` : "●●●●";
}

export function formatElapsedMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function callAssistCallerIdValue(
  vertical: CallAssistUiVertical,
  session: { aniLast4?: string | null; intake?: Pick<CallIntakeData, "locationText"> | null },
): string {
  if (vertical === "911") return formatMaskedAni(session.aniLast4);
  const loc = session.intake?.locationText?.trim();
  if (!loc) return "—";
  return loc.split(/[,·]/)[0]?.trim() || loc;
}

export function shortCallAssistSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  const parts = trimmed.split(/[_-]/);
  const last = parts[parts.length - 1] ?? trimmed;
  if (last.length <= 8) return last;
  return last.slice(-6);
}

export type CallAssistIntakeRow = { key: string; label: string; value: string; alert?: boolean };

export function callAssistIntakeRows(
  vertical: CallAssistUiVertical,
  intake: CallIntakeData | null | undefined,
  classification?: string | null,
): CallAssistIntakeRow[] {
  const data = intake ?? {};
  const type = data.incidentTypeHint?.trim() || humanizeCallAssistToken(classification);
  const injuries =
    data.injuries === true ? "Yes" : data.injuries === false ? "No" : "Unknown";
  const vehicle = [data.vehicleColor, data.vehicleYear, data.vehicleMake, data.vehicleModel, data.vehiclePlate]
    .filter(Boolean)
    .join(" ");
  const locParts = [data.locationText, data.apartmentSuite ? `Apt ${data.apartmentSuite}` : "", data.crossStreets]
    .filter(Boolean)
    .join(" · ");
  const weapons =
    data.weaponsMentioned === true ? data.weaponsDetail || "Yes" : data.weaponsMentioned === false ? "No" : "Unknown";
  const lang = (data.preferredLanguage ?? data.language)?.trim() || "—";
  const zone = [data.zoneName, data.jurisdictionLabel].filter(Boolean).join(" · ");
  const addrConf =
    typeof data.addressConfidence === "number" ? `${Math.round(data.addressConfidence * 100)}%` : "—";

  if (vertical === "campus") {
    return [
      { key: "type", label: "Concern type", value: type },
      { key: "loc", label: "Location", value: data.locationText?.trim() || "—" },
      { key: "medical", label: "Medical needed", value: injuries, alert: data.injuries === true },
      { key: "lang", label: "Preferred language", value: lang },
      { key: "zone", label: "Zone", value: zone || "—" },
    ];
  }
  if (vertical === "venue") {
    return [
      { key: "type", label: "Report type", value: type },
      { key: "loc", label: "Section / row", value: data.locationText?.trim() || "—" },
      { key: "desc", label: "Description", value: data.suspectDescription?.trim() || data.summary?.trim() || "—" },
      { key: "medical", label: "Medical needed", value: injuries, alert: data.injuries === true },
      { key: "contact", label: "Guest contact", value: data.callbackNumber?.trim() || data.callerName?.trim() || "—" },
      { key: "lang", label: "Preferred language", value: lang },
    ];
  }
  return [
    { key: "type", label: "Incident type", value: type },
    { key: "loc", label: "Location", value: locParts || "—" },
    { key: "dir", label: "Direction of travel", value: data.directionOfTravel?.trim() || "—" },
    { key: "injuries", label: "Injuries reported", value: injuries, alert: data.injuries === true },
    { key: "weapons", label: "Weapons", value: weapons, alert: data.weaponsMentioned === true },
    { key: "suspect", label: "Suspect", value: data.suspectDescription?.trim() || "—" },
    { key: "vehicle", label: "Vehicle", value: vehicle || "—" },
    {
      key: "callback",
      label: "Callback",
      value: data.callbackNumber?.trim()
        ? formatMaskedAni(data.callbackNumber.replace(/\D/g, "").slice(-4))
        : `${CALL_ASSIST_VERTICAL_LABELS[vertical].callerIdLabel} on record`,
    },
    { key: "lang", label: "Preferred language", value: lang },
    { key: "zone", label: "Zone", value: zone || "—" },
    { key: "addrConf", label: "Address confidence", value: addrConf },
  ];
}

export const CAD_PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "1 — Emergency",
  2: "2 — Urgent",
  3: "3 — Routine",
  4: "4 — Low",
};

export type CallAssistCadClassification = {
  typeLabel: string;
  natureCode: string;
  priority: 1 | 2 | 3 | 4;
};

export function resolveCallAssistCadClassification(opts: {
  classification?: string | null;
  taxonomyLabel?: string | null;
  natureCode?: string | null;
  mappedNature?: string | null;
  priority?: number | null;
}): CallAssistCadClassification {
  const emergency = opts.classification === "EMERGENCY";
  const nature =
    opts.natureCode?.trim() ||
    opts.mappedNature?.trim() ||
    humanizeCallAssistToken(opts.classification);
  const typeLabel = opts.taxonomyLabel?.trim() || humanizeCallAssistToken(opts.classification);
  const raw = opts.priority;
  const priority: 1 | 2 | 3 | 4 =
    raw === 1 || raw === 2 || raw === 3 || raw === 4 ? raw : emergency ? 1 : 3;
  return { typeLabel, natureCode: nature, priority };
}

export type CallAssistCadReviewField = { k: string; v: string; highlight?: boolean };

export function callAssistCadReviewFields(opts: {
  classification?: string | null;
  natureCode?: string | null;
  mappedNature?: string | null;
  taxonomyLabel?: string | null;
  priority?: number | null;
  location?: string | null;
  callerId: string;
  callerIdLabel?: string;
  locationLabel?: string;
}): CallAssistCadReviewField[] {
  const cad = resolveCallAssistCadClassification(opts);
  return [
    { k: "CAD type", v: cad.typeLabel },
    { k: "Nature code", v: cad.natureCode },
    { k: opts.locationLabel?.trim() || "Location", v: opts.location?.trim() || "—" },
    { k: "Priority", v: CAD_PRIORITY_LABELS[cad.priority], highlight: cad.priority === 1 },
    { k: opts.callerIdLabel?.trim() || "Caller", v: opts.callerId },
  ];
}

export type CallAssistFlagChip = { tone: "w" | "i"; text: string };

export function callAssistFlagChips(opts: {
  vertical: CallAssistUiVertical;
  premiseHazards?: Array<{ officerSafety?: boolean; summary?: string }> | null;
  chronicLocation?: boolean;
  repeatCaller?: boolean;
  ttyMode?: boolean;
  language?: string | null;
  duplicateCount?: number;
  smsFallbackRecommended?: boolean;
}): CallAssistFlagChip[] {
  const labels = CALL_ASSIST_VERTICAL_LABELS[opts.vertical];
  const chips: CallAssistFlagChip[] = [];
  const hazards = opts.premiseHazards ?? [];
  if (hazards.some((h) => h.officerSafety)) {
    chips.push({ tone: "w", text: labels.officerSafetyFlag });
  } else {
    for (const h of hazards) {
      if (h.summary?.trim()) chips.push({ tone: "w", text: h.summary.trim() });
    }
  }
  if (opts.chronicLocation) chips.push({ tone: "w", text: "Repeat location" });
  if ((opts.duplicateCount ?? 0) > 0) {
    chips.push({ tone: "w", text: `${opts.duplicateCount} possible duplicate${opts.duplicateCount === 1 ? "" : "s"}` });
  }
  if (opts.repeatCaller) chips.push({ tone: "w", text: "Repeat caller" });
  chips.push({ tone: "i", text: opts.ttyMode ? "TTY detected" : "TTY not detected" });
  if (opts.smsFallbackRecommended) chips.push({ tone: "i", text: "TTY SMS fallback" });
  const lang = opts.language?.trim().toLowerCase();
  if (lang && lang !== "en" && lang !== "und" && lang !== "english") {
    chips.push({ tone: "i", text: "Translation available" });
  }
  return chips;
}

export function buildCallAssistUiProfile(input: {
  agencyId: string;
  agencyName?: string | null;
  agencyType?: string | null;
  agencyVertical?: string | null;
  shortName?: string | null;
  shiftLabel?: string | null;
  uiVertical?: string | null;
  alertPickupLine?: string | null;
  cadProviderId?: CadProviderId | string | null;
  cadProviderLabel?: string | null;
  retention?: RetentionPolicy | null;
  cadNatureMapping?: Record<string, string> | null;
  classificationLabels?: Record<string, string> | null;
  onboardingComplete?: boolean;
  disclosureText?: string | null;
  role: string;
  displayName?: string | null;
  email?: string | null;
  capabilities: CallAssistUiCapabilities;
  externalDirectory: CallAssistUiDirectoryEntry[];
}): CallAssistUiProfile {
  const vertical = callAssistUiVerticalFromAgency({
    type: input.agencyType,
    vertical: input.agencyVertical,
    agencyId: input.agencyId,
    uiVertical: input.uiVertical,
  });
  const labels = CALL_ASSIST_VERTICAL_LABELS[vertical];
  const userName = callAssistUserDisplayName({ displayName: input.displayName, email: input.email });
  const shortName = input.shortName?.trim() || input.agencyName?.trim() || input.agencyId;
  return {
    agencyId: input.agencyId,
    shortName,
    shiftLabel: input.shiftLabel?.trim() || "",
    vertical,
    userRole: callAssistDisplayRole({ vertical, role: input.role }),
    userName,
    userInitials: callAssistUserInitials(userName),
    cadProvider: resolveCadPushLabel(input.cadProviderId, input.cadProviderLabel),
    callerIdLabel: labels.callerIdLabel,
    locationLabel: labels.locationLabel,
    escalationLabel: labels.escalationLabel,
    transferTarget: labels.transferTarget,
    statLabel2: labels.statLabel2,
    alertSub: labels.alertSub,
    alertPickupLine: input.alertPickupLine?.trim() || null,
    officerSafetyFlag: labels.officerSafetyFlag,
    retentionLabel: formatRetentionPolicyLabel(input.retention),
    cadNatureMapping: input.cadNatureMapping ?? {},
    classificationLabels: input.classificationLabels ?? {},
    onboardingComplete: input.onboardingComplete !== false,
    disclosureText: input.disclosureText?.trim() || "",
    governingLaw: input.retention?.governingLaw?.trim() || null,
    externalDirectory: input.externalDirectory,
    capabilities: input.capabilities,
  };
}
