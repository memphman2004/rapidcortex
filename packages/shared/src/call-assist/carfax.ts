import type { CallIntakeData } from "./intake.js";

export type CARFAXCriterion = {
  id: string;
  description: string;
  met: boolean;
  value?: string;
};

export type CARFAXEligibilityResult = {
  eligible: boolean;
  criteriaChecked: CARFAXCriterion[];
  failedCriteria: string[];
  unresolvedCriteria: string[];
  portalUrl?: string;
  smsDeliveryReady: boolean;
};

export type CARFAXPolicy = {
  portalUrl: string;
  vehicleCrimeHints: string[];
};

const DEFAULT_POLICY: CARFAXPolicy = {
  portalUrl: "",
  vehicleCrimeHints: ["stolen", "burglary", "break-in", "hit and run", "catalytic"],
};

/**
 * Deterministic eligibility. Portal URL is tenant config — never hardcoded to a city.
 */
export function evaluateCarfaxEligibility(
  intake: CallIntakeData,
  policy: Partial<CARFAXPolicy> = {},
): CARFAXEligibilityResult {
  const cfg = { ...DEFAULT_POLICY, ...policy };
  const summary = `${intake.incidentTypeHint ?? ""} ${intake.summary ?? ""}`.toLowerCase();
  const vehicleCrime = cfg.vehicleCrimeHints.some((h) => summary.includes(h.toLowerCase())) || Boolean(intake.vehicleMake || intake.vehiclePlate);
  const identified = Boolean(intake.vehicleMake || intake.vehicleModel || intake.vehiclePlate);
  const noInjury = intake.injuries !== true;
  const hasLocation = Boolean(intake.locationText);
  const historical = intake.isInProgress === false;

  const criteria: CARFAXCriterion[] = [
    { id: "vehicle_crime", description: "Vehicle-related crime", met: vehicleCrime, value: summary.slice(0, 80) },
    { id: "vehicle_identified", description: "Vehicle identified (make/model/plate)", met: identified },
    { id: "no_injury", description: "No injury reported", met: noInjury },
    { id: "has_location", description: "Location provided", met: hasLocation },
    { id: "not_in_progress", description: "Not in progress / report-only", met: historical },
  ];

  const failed = criteria.filter((c) => !c.met).map((c) => c.id);
  const unresolved: string[] = [];
  if (intake.isInProgress === undefined) unresolved.push("not_in_progress");
  if (intake.injuries === undefined) unresolved.push("no_injury");

  const eligible = failed.length === 0 && unresolved.length === 0;
  return {
    eligible,
    criteriaChecked: criteria,
    failedCriteria: failed,
    unresolvedCriteria: unresolved,
    portalUrl: cfg.portalUrl || undefined,
    smsDeliveryReady: eligible && Boolean(cfg.portalUrl) && Boolean(intake.callbackNumber),
  };
}
