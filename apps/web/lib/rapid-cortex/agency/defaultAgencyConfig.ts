import type { AgencyFeatureConfig, CadIntegrationMode } from "@/lib/rapid-cortex/entitlements";
import type { RapidCortexPlan } from "@/lib/rapid-cortex/features";

/**
 * Persisted agency profile (DynamoDB / file store). Maps to entitlements via `toAgencyFeatureConfig`.
 */
export type AgencyConfigRecord = {
  agencyId: string;
  agencyName?: string;
  plan: RapidCortexPlan;
  enabledAddOns: string[];
  limitedFeatureOverrides: string[];
  disabledFeatures: string[];
  cadIntegrationMode: CadIntegrationMode;
  writeBackEnabled: boolean;
  agencyApprovedCadWriteBack: boolean;
  auditLoggingEnabled: boolean;
  sandboxMode: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  /** General program approval for features that require it. */
  agencyApprovalGranted?: boolean;
};

export function defaultAgencyConfigRecord(agencyId: string, partial?: Partial<AgencyConfigRecord>): AgencyConfigRecord {
  const now = new Date().toISOString();
  return {
    agencyId,
    plan: "essential",
    enabledAddOns: [],
    limitedFeatureOverrides: [],
    disabledFeatures: [],
    cadIntegrationMode: "disabled",
    writeBackEnabled: false,
    agencyApprovedCadWriteBack: false,
    auditLoggingEnabled: true,
    sandboxMode: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function toAgencyFeatureConfig(r: AgencyConfigRecord): AgencyFeatureConfig {
  return {
    agencyId: r.agencyId,
    plan: r.plan,
    enabledAddOns: r.enabledAddOns,
    limitedFeatureOverrides: r.limitedFeatureOverrides,
    disabledFeatures: r.disabledFeatures,
    cadIntegrationMode: r.cadIntegrationMode,
    writeBackEnabled: r.writeBackEnabled,
    agencyApprovalGranted: r.agencyApprovalGranted,
    agencyApprovedCadWriteBack: r.agencyApprovedCadWriteBack,
    auditLoggingEnabled: r.auditLoggingEnabled,
    sandboxMode: r.sandboxMode,
    agencyName: r.agencyName,
  };
}

/**
 * Strips unsafe automated write-back unless ops explicitly sets ALLOW_AUTOMATED_CAD_WRITEBACK=true.
 * Documented escape hatch for enterprise-only governance, not a product default.
 */
export function enforceAutomatedWriteBackSafety(
  mode: CadIntegrationMode,
  env: NodeJS.ProcessEnv = process.env,
): CadIntegrationMode {
  if (mode === "automated_writeback" && env.ALLOW_AUTOMATED_CAD_WRITEBACK !== "true") {
    return "assisted_writeback";
  }
  return mode;
}
