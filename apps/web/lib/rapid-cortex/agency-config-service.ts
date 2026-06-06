import "server-only";

import type { UserContext } from "rapid-cortex-shared/types";
import { getAgencyConfigRepository } from "@/lib/rapid-cortex/agency";
import type { AgencyConfigPatch } from "@/lib/rapid-cortex/agency/AgencyConfigRepository";
import {
  defaultAgencyConfigRecord,
  toAgencyFeatureConfig,
  type AgencyConfigRecord,
} from "@/lib/rapid-cortex/agency/defaultAgencyConfig";
import { deriveAgencyConfigFromUser } from "@/lib/rapid-cortex/agency-config";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";
import { rapidCortexFeatureIdsFromTenantEntitlements } from "@/lib/rapid-cortex/tenant-addon-feature-bridge";
import { fetchTenantEntitlementsForUser } from "@/lib/rapid-cortex/tenant-entitlements-server";

export function mergeAgencyConfig(
  base: AgencyFeatureConfig,
  patch: Partial<AgencyFeatureConfig>,
): AgencyFeatureConfig {
  return {
    ...base,
    ...patch,
    enabledAddOns: patch.enabledAddOns ?? base.enabledAddOns,
    limitedFeatureOverrides: patch.limitedFeatureOverrides ?? base.limitedFeatureOverrides,
    disabledFeatures: patch.disabledFeatures ?? base.disabledFeatures,
  };
}

function featureConfigToPatch(fc: Partial<AgencyFeatureConfig>): AgencyConfigPatch {
  const p: AgencyConfigPatch = {};
  if (fc.plan != null) p.plan = fc.plan;
  if (fc.enabledAddOns != null) p.enabledAddOns = fc.enabledAddOns;
  if (fc.limitedFeatureOverrides != null) p.limitedFeatureOverrides = fc.limitedFeatureOverrides;
  if (fc.disabledFeatures != null) p.disabledFeatures = fc.disabledFeatures;
  if (fc.cadIntegrationMode != null) p.cadIntegrationMode = fc.cadIntegrationMode;
  if (fc.writeBackEnabled != null) p.writeBackEnabled = fc.writeBackEnabled;
  if (fc.agencyApprovedCadWriteBack != null) p.agencyApprovedCadWriteBack = fc.agencyApprovedCadWriteBack;
  if (fc.auditLoggingEnabled != null) p.auditLoggingEnabled = fc.auditLoggingEnabled;
  if (fc.agencyApprovalGranted != null) p.agencyApprovalGranted = fc.agencyApprovalGranted;
  if (fc.sandboxMode != null) p.sandboxMode = fc.sandboxMode;
  if (fc.agencyName != null) p.agencyName = fc.agencyName;
  return p;
}

function recordFromDerive(user: UserContext): AgencyConfigRecord {
  const d = deriveAgencyConfigFromUser(user);
  return defaultAgencyConfigRecord(user.agencyId, {
    plan: d.plan,
    enabledAddOns: d.enabledAddOns,
    limitedFeatureOverrides: d.limitedFeatureOverrides,
    disabledFeatures: d.disabledFeatures,
    cadIntegrationMode: d.cadIntegrationMode,
    writeBackEnabled: d.writeBackEnabled,
    agencyApprovedCadWriteBack: d.agencyApprovedCadWriteBack ?? false,
    auditLoggingEnabled: d.auditLoggingEnabled ?? true,
    agencyApprovalGranted: d.agencyApprovalGranted,
    sandboxMode: d.sandboxMode ?? true,
    agencyName: d.agencyName,
  });
}

/**
 * Merges persisted agency row with IdP/env fallbacks (plan default from env when no row).
 */
function mergeEnabledAddOns(
  base: AgencyFeatureConfig,
  extra: Iterable<string>,
): AgencyFeatureConfig {
  const merged = new Set([...base.enabledAddOns, ...extra]);
  return { ...base, enabledAddOns: [...merged] };
}

export async function loadAgencyFeatureConfig(user: UserContext | null): Promise<AgencyFeatureConfig> {
  const base = deriveAgencyConfigFromUser(user);
  if (!user) return base;

  const repo = getAgencyConfigRepository();
  const row = await repo.getAgencyConfig(user.agencyId);
  let config = row
    ? mergeAgencyConfig(base, { ...toAgencyFeatureConfig(row), plan: row.plan })
    : base;

  const entitlements = await fetchTenantEntitlementsForUser(user);
  if (entitlements) {
    config = mergeEnabledAddOns(config, rapidCortexFeatureIdsFromTenantEntitlements(entitlements));
  }

  return config;
}

export async function saveAgencyFeatureConfigPatch(
  user: UserContext,
  patch: Partial<AgencyFeatureConfig>,
): Promise<AgencyConfigRecord> {
  const repo = getAgencyConfigRepository();
  let current = await repo.getAgencyConfig(user.agencyId);
  if (!current) {
    current = recordFromDerive(user);
    await repo.upsertAgencyConfig(current);
  }
  const asPatch = featureConfigToPatch(patch);
  return repo.patchAgencyConfig(user.agencyId, asPatch, user.userId);
}

export async function loadAgencyRecord(user: UserContext): Promise<AgencyConfigRecord | null> {
  return getAgencyConfigRepository().getAgencyConfig(user.agencyId);
}
