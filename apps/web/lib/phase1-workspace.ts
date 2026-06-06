/**
 * Ensures workspace packages resolve at build time (Phase 1 monorepo smoke).
 * Safe to import from server components only if you prefer to keep bundles lean.
 */
import { INTEGRATIONS_PACKAGE_VERSION } from "rapid-cortex-integrations";
import { PROTOCOL_CATALOG_VERSION, listDefaultPackIds } from "rapid-cortex-protocols";
import { AUDIT_EVENT_TYPES, ROLES } from "rapid-cortex-security";
import { DEMO_SCENARIO_CATALOG } from "rapid-cortex-shared";

export function getWorkspaceBuildProbe() {
  return {
    protocolsVersion: PROTOCOL_CATALOG_VERSION,
    defaultPackCount: listDefaultPackIds().length,
    integrationsVersion: INTEGRATIONS_PACKAGE_VERSION,
    sharedScenarioCatalogSize: DEMO_SCENARIO_CATALOG.length,
    roles: [...ROLES],
    sampleAuditAction: AUDIT_EVENT_TYPES.ANALYSIS_CREATED,
  };
}
