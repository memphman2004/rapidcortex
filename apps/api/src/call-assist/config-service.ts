import {
  DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS,
  GENERIC_DISCLOSURE_TEXT,
  KCPD_LEX_DEMO_SCENARIOS,
  KCPD_LEX_DISCLOSURE_TEXT,
  KCPD_TENANT_SEED,
  kcpdExternalAgencySeed,
  MISSOURI_SUNSHINE_RETENTION_POLICY,
  normalizeConfidenceThresholds,
  resolveAgencyTaxonomy,
  validateTaxonomyEmergencyLocks,
  type CallAssistAdminConfigPatch,
  type RetentionPolicy,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { callAssistStore, type CallAssistTenantConfig } from "./store.js";

const GENERIC_HOURS = { timezone: "America/Chicago", openMinutes: 0, closeMinutes: 24 * 60, allDay: true };

export function defaultTenantConfig(agencyId: string): CallAssistTenantConfig {
  const kcpd = env.callAssistSeedProfile === "kcpd";
  const seed = kcpd ? KCPD_TENANT_SEED : null;
  return {
    agencyId,
    disclosureEnabled: true,
    disclosureText: seed?.disclosureText ?? GENERIC_DISCLOSURE_TEXT,
    emergencyDestination: seed?.emergencyDestination ?? "911",
    demoEmergencyDestination: seed?.demoEmergencyDestination ?? "+15555550111",
    cadProviderId: seed?.cadProviderId ?? "mock",
    cadProviderLabel: seed?.cadProviderId === "motorola-premierone" ? "PremierOne" : null,
    cadHumanReviewRequired: true,
    cadNatureMapping: seed?.natureMapping ?? {},
    carfaxPortalUrl: seed?.carfaxPortalUrl ?? "",
    onlineReportUrl: seed?.onlineReportUrl ?? "",
    retention: seed?.retention ?? ({
      ...MISSOURI_SUNSHINE_RETENTION_POLICY,
      policyId: "generic-default",
      jurisdiction: "US",
      statute: undefined,
      displayName: undefined,
      policyName: undefined,
      governingLaw: null,
    } satisfies RetentionPolicy),
    operatingHours: GENERIC_HOURS,
    videoAssistEnabled: true,
    confidenceThresholds: DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS,
    taxonomy: null,
    vertical: seed ? "911" : undefined,
    uiVertical: seed ? "911" : undefined,
    agencyShortName: seed ? "KCPD" : undefined,
    agencyName: seed ? "Kansas City Missouri Police Department" : undefined,
    shortName: seed ? "KCPD" : undefined,
    demoScenarios: seed ? KCPD_LEX_DEMO_SCENARIOS.map((row) => ({ ...row, utterances: [...row.utterances] })) : undefined,
    testDID: seed ? process.env.KCPD_TEST_DID?.trim() || undefined : undefined,
    lexBotId: seed ? process.env.LEX_BOT_ID?.trim() || undefined : undefined,
    lexBotAliasId: seed ? process.env.LEX_BOT_ALIAS_ID?.trim() || undefined : undefined,
    onboardingComplete: Boolean(seed),
    onboardingCompletedAt: seed ? new Date().toISOString() : null,
    seededProfile: seed?.profileId,
    updatedAt: new Date().toISOString(),
  };
}

export async function getOrCreateConfig(agencyId: string): Promise<CallAssistTenantConfig> {
  const existing = await callAssistStore.getConfig(agencyId);
  if (existing) return existing;
  const created = defaultTenantConfig(agencyId);
  await callAssistStore.putConfig(created);
  if (created.testDID) {
    await callAssistStore.putDidLookup(created.testDID, agencyId);
  }
  if (env.callAssistSeedProfile === "kcpd") {
    const agencies = kcpdExternalAgencySeed(agencyId);
    for (const row of agencies) {
      await callAssistStore.putExternal(row);
    }
  }
  return created;
}

/** Writes KCPD tenant config + test DID lookup. Required before Connect test calls. */
export async function seedKcpdLexTenant(agencyId: string, testDID?: string): Promise<CallAssistTenantConfig> {
  const did = (testDID ?? process.env.KCPD_TEST_DID ?? "").trim();
  const existing = await callAssistStore.getConfig(agencyId);
  const created: CallAssistTenantConfig = {
    ...(existing ?? defaultTenantConfig(agencyId)),
    agencyId,
    disclosureEnabled: true,
    disclosureText: KCPD_LEX_DISCLOSURE_TEXT,
    emergencyDestination: KCPD_TENANT_SEED.emergencyDestination,
    demoEmergencyDestination: KCPD_TENANT_SEED.demoEmergencyDestination,
    cadProviderId: KCPD_TENANT_SEED.cadProviderId,
    cadProviderLabel: "PremierOne",
    cadNatureMapping: KCPD_TENANT_SEED.natureMapping,
    carfaxPortalUrl: KCPD_TENANT_SEED.carfaxPortalUrl,
    onlineReportUrl: KCPD_TENANT_SEED.onlineReportUrl,
    retention: KCPD_TENANT_SEED.retention,
    agencyShortName: "KCPD",
    shortName: "KCPD",
    agencyName: "Kansas City Missouri Police Department",
    vertical: "911",
    uiVertical: "911",
    seededProfile: "kcpd",
    demoScenarios: KCPD_LEX_DEMO_SCENARIOS.map((row) => ({ ...row, utterances: [...row.utterances] })),
    testDID: did || existing?.testDID,
    lexBotId: process.env.LEX_BOT_ID?.trim() || existing?.lexBotId,
    lexBotAliasId: process.env.LEX_BOT_ALIAS_ID?.trim() || existing?.lexBotAliasId,
    onboardingComplete: true,
    onboardingCompletedAt: existing?.onboardingCompletedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await callAssistStore.putConfig(created);
  if (created.testDID) await callAssistStore.putDidLookup(created.testDID, agencyId);
  for (const row of kcpdExternalAgencySeed(agencyId)) {
    await callAssistStore.putExternal(row);
  }
  return created;
}

export async function patchConfig(
  agencyId: string,
  patch: CallAssistAdminConfigPatch,
): Promise<CallAssistTenantConfig> {
  const current = await getOrCreateConfig(agencyId);
  const next: CallAssistTenantConfig = {
    ...current,
    agencyId,
    cadHumanReviewRequired: true,
    updatedAt: new Date().toISOString(),
  };

  if (patch.disclosureEnabled !== undefined) next.disclosureEnabled = patch.disclosureEnabled;
  if (patch.disclosureText) next.disclosureText = patch.disclosureText;
  if (typeof patch.emergencyDestination === "string" && patch.emergencyDestination.trim()) {
    next.emergencyDestination = patch.emergencyDestination.trim();
  }
  if (patch.demoEmergencyDestination) next.demoEmergencyDestination = patch.demoEmergencyDestination;
  if (patch.cadProviderId) next.cadProviderId = patch.cadProviderId;
  if (patch.cadProviderLabel !== undefined) next.cadProviderLabel = patch.cadProviderLabel;
  if (patch.carfaxPortalUrl !== undefined) next.carfaxPortalUrl = patch.carfaxPortalUrl;
  if (patch.onlineReportUrl !== undefined) next.onlineReportUrl = patch.onlineReportUrl;
  if (patch.videoAssistEnabled !== undefined) next.videoAssistEnabled = patch.videoAssistEnabled;
  if (patch.alertPickupLine !== undefined) next.alertPickupLine = patch.alertPickupLine;
  if (patch.agencyName !== undefined) next.agencyName = patch.agencyName;

  const short = patch.agencyShortName ?? patch.shortName;
  if (short !== undefined) {
    next.agencyShortName = short;
    next.shortName = short;
  } else if (patch.shortName !== undefined) {
    next.shortName = patch.shortName;
  }

  const vertical = patch.vertical ?? patch.uiVertical;
  if (vertical) {
    next.vertical = vertical;
    next.uiVertical = vertical;
    if (patch.taxonomy === undefined && current.vertical && current.vertical !== vertical) {
      next.taxonomy = null;
    }
  }

  if (patch.operatingHours) {
    next.operatingHours = {
      ...current.operatingHours,
      ...patch.operatingHours,
      timezone: patch.operatingHours.timezone ?? current.operatingHours.timezone,
      openMinutes: patch.operatingHours.openMinutes ?? current.operatingHours.openMinutes,
      closeMinutes: patch.operatingHours.closeMinutes ?? current.operatingHours.closeMinutes,
    };
    if (patch.operatingHours.allDay === true) {
      next.operatingHours.openMinutes = 0;
      next.operatingHours.closeMinutes = 24 * 60;
      next.operatingHours.allDay = true;
      delete next.operatingHours.days;
    }
  }

  if (patch.retention) {
    next.retention = { ...current.retention, ...patch.retention };
    if (patch.retention.policyName && !patch.retention.displayName) {
      next.retention.displayName = patch.retention.policyName;
    }
    if (patch.retention.governingLaw === undefined && patch.retention.policyName) {
      next.retention.governingLaw = patch.retention.policyName;
    }
  }

  if (patch.confidenceThresholds) {
    next.confidenceThresholds = normalizeConfidenceThresholds({
      ...current.confidenceThresholds,
      ...patch.confidenceThresholds,
    });
  }

  if (patch.taxonomy !== undefined) {
    if (patch.taxonomy) {
      const baseline = resolveAgencyTaxonomy(current);
      const lock = validateTaxonomyEmergencyLocks(baseline, patch.taxonomy);
      if (lock) {
        const err = new Error(`TAXONOMY_LOCK:${lock}`);
        throw err;
      }
    }
    next.taxonomy = patch.taxonomy;
  }

  if (patch.demoScenarios !== undefined) next.demoScenarios = patch.demoScenarios;

  if (patch.onboardingComplete === true) {
    next.onboardingComplete = true;
    next.onboardingCompletedAt = patch.onboardingCompletedAt ?? new Date().toISOString();
  } else if (patch.onboardingComplete === false) {
    next.onboardingComplete = false;
  }

  await callAssistStore.putConfig(next);
  return next;
}

export function isWithinOperatingHours(config: CallAssistTenantConfig, now = new Date()): boolean {
  if (config.operatingHours.allDay) return true;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const days = config.operatingHours.days;
  if (days && days.length > 0) {
    const dow = now.getDay();
    const row = days.find((d) => d.day === dow);
    if (!row || row.closed) return false;
    if (row.openMinutes === 0 && row.closeMinutes === 24 * 60) return true;
    if (row.openMinutes <= row.closeMinutes) return minutes >= row.openMinutes && minutes < row.closeMinutes;
    return minutes >= row.openMinutes || minutes < row.closeMinutes;
  }
  const { openMinutes, closeMinutes } = config.operatingHours;
  if (openMinutes === 0 && closeMinutes === 24 * 60) return true;
  if (openMinutes <= closeMinutes) return minutes >= openMinutes && minutes < closeMinutes;
  return minutes >= openMinutes || minutes < closeMinutes;
}

export function newExternalId(): string {
  return makeId("ext").replace("ext_", "ext_");
}

export const CALL_ASSIST_SHIFT_TTL_MS = 14 * 60 * 60 * 1000;
