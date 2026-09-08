import {
  buildCallAssistUiProfile,
  isCallAssistOnboardingComplete,
  resolveAgencyTaxonomy,
  type CallAssistUiProfile,
} from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { callAssistStore } from "./store.js";
import { getOrCreateConfig } from "./config-service.js";

const authz = new AuthorizationService();
const agencies = new AgencyRepository();

export async function loadCallAssistUiProfile(
  user: UserContext,
  tenantAgencyId: string = user.agencyId,
): Promise<CallAssistUiProfile> {
  const [agency, config, externals, shift] = await Promise.all([
    agencies.get(tenantAgencyId),
    getOrCreateConfig(tenantAgencyId),
    callAssistStore.listExternal(tenantAgencyId),
    callAssistStore.getShift(tenantAgencyId),
  ]);

  const taxonomy = resolveAgencyTaxonomy({
    taxonomy: config.taxonomy,
    vertical: config.vertical ?? config.uiVertical,
  });
  const classificationLabels = Object.fromEntries(taxonomy.callTypes.map((t) => [t.id, t.label]));

  const directory = externals
    .filter((row) => row.enabled)
    .map((row) => ({
      externalAgencyId: row.externalAgencyId,
      name: row.externalAgencyName,
      number: row.phoneNumber?.trim() || row.sipUri?.trim() || "unconfigured",
    }));

  return buildCallAssistUiProfile({
    agencyId: tenantAgencyId,
    agencyName: config.agencyName ?? agency?.name,
    agencyType: agency?.type,
    agencyVertical: config.vertical ?? config.uiVertical ?? agency?.vertical ?? user.vertical,
    shortName: config.agencyShortName ?? config.shortName,
    shiftLabel: shift?.currentShift ?? config.shiftLabel,
    uiVertical: config.vertical ?? config.uiVertical,
    alertPickupLine: config.alertPickupLine,
    cadProviderId: config.cadProviderId,
    cadProviderLabel: config.cadProviderLabel,
    retention: config.retention,
    cadNatureMapping: config.cadNatureMapping,
    classificationLabels,
    onboardingComplete: isCallAssistOnboardingComplete(config),
    disclosureText: config.disclosureText,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
    capabilities: {
      takeover: authz.canPerform(user, "call_assist.session.takeover"),
      cadPush: authz.canPerform(user, "call_assist.cad.push"),
      forceTransfer: authz.canPerform(user, "call_assist.transfer.force"),
      admin: authz.canPerform(user, "call_assist.admin.config"),
      records: authz.canPerform(user, "call_assist.records.request"),
      demo: authz.canPerform(user, "call_assist.demo.run"),
      analytics: authz.canPerform(user, "call_assist.analytics.view"),
    },
    externalDirectory: directory,
  });
}
