import type { UserContext } from "rapid-cortex-shared";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";

export const DEFAULT_AGENCY_CONFIG: AgencyFeatureConfig = {
  agencyId: "default-agency",
  plan: "essential",
  enabledAddOns: [],
  limitedFeatureOverrides: [],
  disabledFeatures: [],
  cadIntegrationMode: "disabled",
  writeBackEnabled: false,
  agencyApprovalGranted: false,
  agencyApprovedCadWriteBack: false,
  auditLoggingEnabled: true,
};

export function deriveAgencyConfigFromUser(user: UserContext | null): AgencyFeatureConfig {
  if (!user) {
    return DEFAULT_AGENCY_CONFIG;
  }

  // Plan source of truth should come from billing/subscription service; this is a safe fallback.
  const plan = (process.env.NEXT_PUBLIC_DEFAULT_PLAN ?? "essential").trim().toLowerCase();
  const normalizedPlan =
    plan === "professional" || plan === "command" || plan === "enterprise"
      ? plan
      : "essential";

  return {
    ...DEFAULT_AGENCY_CONFIG,
    agencyId: user.agencyId ?? DEFAULT_AGENCY_CONFIG.agencyId,
    plan: normalizedPlan,
  };
}
