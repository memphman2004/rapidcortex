import { describe, expect, it } from "vitest";
import {
  RC_LITE_FORBIDDEN_FEATURES,
  cadExportApiEntitled,
  cadExportDashboardWorkflowEntitled,
  featureEntitled,
  resolveFeatureEntitlements,
} from "./entitlements.js";

describe("resolveFeatureEntitlements", () => {
  it("grants Essential baseline dashboards and dashboard_access", () => {
    const s = resolveFeatureEntitlements({
      planId: "essential",
      addOnIds: [],
    });
    expect(s.has("dispatcher_dashboard")).toBe(true);
    expect(s.has("dashboard_access")).toBe(true);
    expect(s.has("agency_admin_dashboard")).toBe(true);
    expect(s.has("api_access")).toBe(false);
  });

  it("unlocks QA when Command plan", () => {
    const s = resolveFeatureEntitlements({
      planId: "command",
      addOnIds: [],
    });
    expect(s.has("qa_dashboard")).toBe(true);
    expect(s.has("dashboard_access")).toBe(true);
    expect(cadExportDashboardWorkflowEntitled({ planId: "command", addOnIds: [] })).toBe(true);
    expect(cadExportApiEntitled({ planId: "command", addOnIds: [] })).toBe(false);
  });

  it("API add-on yields portal + API surface plus webhooks", () => {
    const s = resolveFeatureEntitlements({
      planId: "essential",
      addOnIds: ["api_access"],
    });
    expect(s.has("api_access")).toBe(true);
    expect(s.has("webhooks")).toBe(true);
    expect(s.has("api_portal_access")).toBe(true);
  });

  it("RC Lite is API-product only — excludes dashboard_access and ECC consoles", () => {
    const input = { planId: "rc_lite", addOnIds: [] as string[] };
    const s = resolveFeatureEntitlements(input);
    expect(s.has("dashboard_access")).toBe(false);
    expect(s.has("agency_admin_dashboard")).toBe(false);
    expect(s.has("dispatcher_dashboard")).toBe(false);
    expect(s.has("full_incident_console")).toBe(false);
    expect(featureEntitled(input, "incident_intelligence_api")).toBe(true);
    expect(featureEntitled(input, "cad_export_api")).toBe(true);
    expect(featureEntitled(input, "api_key_management")).toBe(true);
    for (const fk of RC_LITE_FORBIDDEN_FEATURES) {
      expect(s.has(fk)).toBe(false);
    }
    expect(cadExportDashboardWorkflowEntitled(input)).toBe(false);
    expect(cadExportApiEntitled(input)).toBe(true);
  });

  it("maps legacy intelligence_api plan id to RC Lite entitlements", () => {
    const s = resolveFeatureEntitlements({
      planId: "intelligence_api",
      addOnIds: [],
    });
    expect(s.has("api_access")).toBe(true);
    expect(s.has("dispatcher_dashboard")).toBe(false);
  });

  it("supports featureOverrides merged like RC Admin catalog tooling", () => {
    const s = resolveFeatureEntitlements({
      planId: "essential",
      addOnIds: [],
      featureOverrides: { qa_dashboard: true },
    });
    expect(s.has("qa_dashboard")).toBe(true);
  });

  it("RC Lite connects to external API metering — billing keyed off tenant + hashed API credentials", () => {
    expect(featureEntitled({ planId: "rc_lite", addOnIds: [] }, "api_access")).toBe(true);
  });
});
