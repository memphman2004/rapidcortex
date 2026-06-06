import { isPilotTestModeEnabled } from "@/lib/pilot-test-mode";
import {
  FEATURE_AVAILABILITY,
  type FeatureAvailability,
  getRapidCortexFeatureById,
  RAPID_CORTEX_FEATURES,
  type RapidCortexFeature,
  type RapidCortexPlan,
} from "./features";

export type CadIntegrationMode =
  | "disabled"
  | "read_only"
  | "assisted_writeback"
  | "automated_writeback";

export type AgencyFeatureConfig = {
  agencyId: string;
  plan: RapidCortexPlan;
  enabledAddOns: string[];
  limitedFeatureOverrides: string[];
  disabledFeatures: string[];
  cadIntegrationMode: CadIntegrationMode;
  writeBackEnabled: boolean;
  /** General agency sign-off for features that require it (e.g. policy, pilot scope). */
  agencyApprovalGranted?: boolean;
  /** Explicit approval for any CAD write-back to systems of record (separate from general approval). */
  agencyApprovedCadWriteBack?: boolean;
  auditLoggingEnabled?: boolean;
  /** When true, demo/sandbox responses are allowed from API routes that support pilot mode. */
  sandboxMode?: boolean;
  agencyName?: string;
};

const VALID_FEATURE_AVAILABILITY = new Set<string>(FEATURE_AVAILABILITY);

type FeatureAccessResult = {
  allowed: boolean;
  availability: FeatureAvailability;
  reason?: string;
};

export class FeatureAccessError extends Error {
  readonly featureId: string;

  constructor(featureId: string, message: string) {
    super(message);
    this.name = "FeatureAccessError";
    this.featureId = featureId;
  }
}

export function getPlanFeatures(plan: RapidCortexPlan): RapidCortexFeature[] {
  return RAPID_CORTEX_FEATURES.filter((feature) => feature.planAvailability[plan] !== "unavailable");
}

export function getFeatureAvailability(
  plan: RapidCortexPlan,
  featureId: string,
): FeatureAvailability {
  const feature = getRapidCortexFeatureById(featureId);
  if (!feature) return "unavailable";
  const availability = feature.planAvailability[plan];
  if (!VALID_FEATURE_AVAILABILITY.has(availability)) return "unavailable";
  return availability;
}

export function isFeatureIncluded(plan: RapidCortexPlan, featureId: string): boolean {
  return getFeatureAvailability(plan, featureId) === "included";
}

export function isFeatureLimited(plan: RapidCortexPlan, featureId: string): boolean {
  return getFeatureAvailability(plan, featureId) === "limited";
}

export function isFeatureAddOn(plan: RapidCortexPlan, featureId: string): boolean {
  return getFeatureAvailability(plan, featureId) === "add_on";
}

export function isFeatureUnavailable(plan: RapidCortexPlan, featureId: string): boolean {
  return getFeatureAvailability(plan, featureId) === "unavailable";
}

export function isFeatureEnabledForAgency(
  agencyConfig: AgencyFeatureConfig,
  featureId: string,
): boolean {
  return evaluateFeatureAccess(agencyConfig, featureId).allowed;
}

export function requireFeatureAccess(
  agencyConfig: AgencyFeatureConfig,
  featureId: string,
): void {
  const result = evaluateFeatureAccess(agencyConfig, featureId);
  if (!result.allowed) {
    throw new FeatureAccessError(
      featureId,
      result.reason ?? `Feature '${featureId}' is not enabled for this agency.`,
    );
  }
}

function evaluateFeatureAccess(
  agencyConfig: AgencyFeatureConfig,
  featureId: string,
): FeatureAccessResult {
  const feature = getRapidCortexFeatureById(featureId);
  if (!feature) {
    return { allowed: false, availability: "unavailable", reason: "Unknown feature." };
  }

  if (agencyConfig.disabledFeatures.includes(featureId)) {
    return {
      allowed: false,
      availability: feature.planAvailability[agencyConfig.plan],
      reason: "Feature disabled by agency configuration.",
    };
  }

  let availability = getFeatureAvailability(agencyConfig.plan, featureId);
  if (availability === "limited" && agencyConfig.limitedFeatureOverrides.includes(featureId)) {
    availability = "included";
  }

  if (availability === "unavailable") {
    return { allowed: false, availability, reason: "Feature not available in current plan." };
  }

  if (availability === "add_on" && !agencyConfig.enabledAddOns.includes(featureId)) {
    if (process.env.NODE_ENV !== "production" && isPilotTestModeEnabled()) {
      return { allowed: true, availability };
    }
    return {
      allowed: false,
      availability,
      reason: "Feature requires add-on enablement. Contact our support team.",
    };
  }

  const addOnUnlocked =
    availability === "add_on" && agencyConfig.enabledAddOns.includes(featureId);
  if (
    !feature.defaultEnabled &&
    availability !== "included" &&
    availability !== "limited" &&
    !addOnUnlocked
  ) {
    return {
      allowed: false,
      availability,
      reason: "Feature is not enabled by default.",
    };
  }

  if (feature.requiresAgencyApproval && agencyConfig.agencyApprovalGranted !== true) {
    return {
      allowed: false,
      availability,
      reason: "Agency approval required before feature can be used.",
    };
  }

  if (feature.requiresAuditLog && agencyConfig.auditLoggingEnabled === false) {
    return {
      allowed: false,
      availability,
      reason: "Audit logging must be enabled for this workflow.",
    };
  }

  if (
    featureId === "cad_assisted_writeback" ||
    featureId === "cad_automated_writeback" ||
    featureId === "cad_rollback_plan"
  ) {
    const cadGuard = evaluateCadWriteBackGuards(agencyConfig, featureId);
    if (!cadGuard.allowed) {
      return cadGuard;
    }
  }

  return { allowed: true, availability };
}

function evaluateCadWriteBackGuards(
  agencyConfig: AgencyFeatureConfig,
  featureId: string,
): FeatureAccessResult {
  if (agencyConfig.cadIntegrationMode !== "assisted_writeback" &&
      agencyConfig.cadIntegrationMode !== "automated_writeback") {
    return {
      allowed: false,
      availability: getFeatureAvailability(agencyConfig.plan, featureId),
      reason: "CAD write-back requires assisted_writeback or automated_writeback mode.",
    };
  }

  if (!agencyConfig.writeBackEnabled) {
    return {
      allowed: false,
      availability: getFeatureAvailability(agencyConfig.plan, featureId),
      reason: "CAD write-back is disabled. Enable writeBackEnabled after approval.",
    };
  }

  if (agencyConfig.agencyApprovedCadWriteBack !== true) {
    return {
      allowed: false,
      availability: getFeatureAvailability(agencyConfig.plan, featureId),
      reason: "CAD write-back requires explicit agency approval (agencyApprovedCadWriteBack).",
    };
  }

  if (agencyConfig.auditLoggingEnabled === false) {
    return {
      allowed: false,
      availability: getFeatureAvailability(agencyConfig.plan, featureId),
      reason: "CAD write-back requires audit logging.",
    };
  }

  if (featureId === "cad_automated_writeback") {
    return {
      allowed: false,
      availability: getFeatureAvailability(agencyConfig.plan, featureId),
      reason:
        "Automated CAD write-back is blocked by default for pilot safety and requires explicit governance override.",
    };
  }

  return { allowed: true, availability: getFeatureAvailability(agencyConfig.plan, featureId) };
}
