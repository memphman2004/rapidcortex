import type { MonetizationFeatureKey } from "./feature-keys.js";
import type { MonetizationPlanId } from "./plan-ids.js";
import type { EntitlementResolutionInput } from "./entities.js";
import { isMonetizationPlanId } from "./guards.js";

/** Legacy Dynamo rows may still store `intelligence_api`; canonical id is `rc_lite`. */
export function canonicalMonetizationPlanId(raw: string | null | undefined): MonetizationPlanId | null {
  if (raw == null) return null;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;
  const id = trimmed === "intelligence_api" ? "rc_lite" : trimmed;
  return isMonetizationPlanId(id) ? id : null;
}

const ALL_DASH_KEYS: MonetizationFeatureKey[] = [
  "dispatcher_dashboard",
  "supervisor_dashboard",
  "agency_admin_dashboard",
];

/** SaaS dashboards + explicit product gate flag (RC Lite intentionally omits `dashboard_access`). */
const PLATFORM_DASH_GATE: MonetizationFeatureKey[] = [...ALL_DASH_KEYS, "dashboard_access"];

/**
 * RC Lite = standalone API product (secure intelligence for CAD vendors, dispatch stacks, emergency platforms).
 * Not a smaller dashboard plan — no dispatcher/supervisor/incident console entitlement.
 */
export const RC_LITE_API_ONLY_FEATURES: readonly MonetizationFeatureKey[] = [
  "api_access",
  "api_portal_access",
  "sandbox_access",
  "production_api_access",
  "developer_docs",
  "api_key_management",
  "api_usage_dashboard",
  "audit_logs_api",
  "webhooks",
  "incident_intelligence_api",
  "cad_export_api",
  "transcription_api",
  "translation_api",
  "caller_link_api",
  "caller_media_api",
  "qa_analysis_api",
] as const;

/** Console / workflow flags that must never resolve from an `rc_lite` plan row. */
export const RC_LITE_FORBIDDEN_FEATURES: readonly MonetizationFeatureKey[] = [
  "dispatcher_dashboard",
  "supervisor_dashboard",
  "agency_admin_dashboard",
  "qa_dashboard",
  "executive_dashboard",
  "it_security_dashboard",
  "responder_dashboard",
  "dashboard_access",
  "advanced_reports_dashboard",
  "full_incident_console",
  "command_center_ui",
  "advanced_reports",
  "ai_summary",
  "transcription",
  "caller_text",
  "cad_export",
] as const;

const PLAN_BASE: Record<MonetizationPlanId, ReadonlySet<MonetizationFeatureKey>> = {
  essential: new Set([
    ...PLATFORM_DASH_GATE,
    "ai_summary",
    "transcription",
    "advanced_reports",
  ]),
  command: new Set([
    ...PLATFORM_DASH_GATE,
    "qa_dashboard",
    "executive_dashboard",
    "it_security_dashboard",
    "responder_dashboard",
    "ai_summary",
    "transcription",
    "translation",
    "caller_text",
    "caller_photo",
    "caller_video",
    "advanced_reports",
    "advanced_reports_dashboard",
    "cad_export",
    "qa_scorecards",
    "supervisor_silent_monitor",
    "full_incident_console",
  ]),
  enterprise_statewide: new Set([
    ...PLATFORM_DASH_GATE,
    "qa_dashboard",
    "executive_dashboard",
    "it_security_dashboard",
    "responder_dashboard",
    "ai_summary",
    "transcription",
    "translation",
    "caller_text",
    "caller_photo",
    "caller_video",
    "live_video",
    "advanced_reports",
    "grant_reporting",
    "advanced_reports_dashboard",
    "full_incident_console",
    "command_center_ui",
    "cad_export",
    "cad_api_push",
    "qa_scorecards",
    "supervisor_silent_monitor",
    "premium_support",
    "govcloud_option",
    "webhooks",
    "api_access",
  ]),
  rc_lite: new Set(RC_LITE_API_ONLY_FEATURES),
};

/** Add-on → extra features unlocked (merged with plan). */
const ADD_ON_FEATURES: Record<string, ReadonlyArray<MonetizationFeatureKey>> = {
  setup_implementation_fee: [],
  cad_integration: ["cad_export", "cad_api_push"],
  ai_call_intelligence: ["ai_summary"],
  transcription_translation: ["transcription", "translation"],
  caller_media: ["caller_text", "caller_photo", "caller_video", "live_video"],
  supervisor_qa: [
    "qa_dashboard",
    "qa_scorecards",
    "supervisor_silent_monitor",
    "dispatcher_dashboard",
    "supervisor_dashboard",
  ],
  api_access: ["api_access", "webhooks", "api_portal_access"],
  premium_support: ["premium_support"],
  onsite_deployment_training: [],
};

function activeAddOnIds(
  requested: readonly string[] | undefined,
  defs: EntitlementResolutionInput["monetizationAddOnDefs"],
): Set<string> {
  const ids = [...(requested ?? [])];
  if (!defs) return new Set(ids);
  const activeById = new Map<string, boolean | undefined>(
    [...defs].map((d) => [d.addOnId, d.isActive]),
  );
  const out = new Set<string>();
  for (const id of ids) {
    const flagged = activeById.get(id);
    if (flagged === false) continue;
    out.add(id);
  }
  return out;
}

/**
 * Resolve enabled features from plan + add-ons + explicit overrides (overrides win).
 */
export function resolveFeatureEntitlements(input: EntitlementResolutionInput): Set<MonetizationFeatureKey> {
  const { planId, featureOverrides } = input;
  const pid = canonicalMonetizationPlanId(planId ?? "");

  const base = pid ? new Set(PLAN_BASE[pid]) : new Set<MonetizationFeatureKey>();
  const addOns = activeAddOnIds(input.addOnIds, input.monetizationAddOnDefs);
  for (const aid of addOns) {
    const feats = ADD_ON_FEATURES[aid];
    if (!feats) continue;
    for (const f of feats) base.add(f);
  }

  if (featureOverrides) {
    for (const [k, v] of Object.entries(featureOverrides)) {
      if (v === true) base.add(k as MonetizationFeatureKey);
      if (v === false) base.delete(k as MonetizationFeatureKey);
    }
  }

  return base;
}

export function featureEntitled(
  input: EntitlementResolutionInput,
  feature: MonetizationFeatureKey,
): boolean {
  return resolveFeatureEntitlements(input).has(feature);
}

/** Full platform CAD workflow / console surfaces (RC Lite uses `cad_export_api` only). */
export function cadExportDashboardWorkflowEntitled(input: EntitlementResolutionInput): boolean {
  return resolveFeatureEntitlements(input).has("cad_export");
}

/** CAD export through approved external API routes (RC Lite or platform API add-on). */
export function cadExportApiEntitled(input: EntitlementResolutionInput): boolean {
  return resolveFeatureEntitlements(input).has("cad_export_api");
}
