import type { RcLiteApiScope } from "./scopes.js";

/**
 * Product modules for quotes and documentation — not dashboard entitlements.
 * Each bundle maps to API scopes (RC Lite) and internal commercial packaging.
 */

export type RcLiteProductBundleId =
  | "rc_lite_core_intelligence"
  | "rc_lite_cad_export"
  | "rc_lite_voice"
  | "rc_lite_caller_media"
  | "rc_lite_qa_intelligence"
  | "rc_lite_enterprise_controls";

export type RcLiteProductBundle = {
  id: RcLiteProductBundleId;
  label: string;
  summary: string;
  scopes: readonly RcLiteApiScope[];
};

export const RC_LITE_PRODUCT_BUNDLES: readonly RcLiteProductBundle[] = [
  {
    id: "rc_lite_core_intelligence",
    label: "RC Lite Core",
    summary: "Incident classification, risk scoring, recommended actions, explainability payloads.",
    scopes: ["intelligence:write", "usage:read"],
  },
  {
    id: "rc_lite_cad_export",
    label: "RC Lite CAD",
    summary: "CAD export payloads, CAD event formatting, manual-review queue linkage.",
    scopes: ["cad:write"],
  },
  {
    id: "rc_lite_voice",
    label: "RC Lite Voice",
    summary: "Transcription jobs, multilingual translation surfaces, realtime token minting.",
    scopes: ["transcription:write", "translation:write"],
  },
  {
    id: "rc_lite_caller_media",
    label: "RC Lite Caller Media",
    summary: "Secure caller links, media upload/session tokens, silent texting hooks.",
    scopes: ["caller_links:write", "media:write"],
  },
  {
    id: "rc_lite_qa_intelligence",
    label: "RC Lite QA Intelligence",
    summary: "Call scoring, policy adherence, training summaries, supervisor flags.",
    scopes: ["qa:write"],
  },
  {
    id: "rc_lite_enterprise_controls",
    label: "RC Lite Enterprise Controls",
    summary: "SLA-backed lanes, GovCloud/data residency, private deployment, custom CAD adapters.",
    scopes: ["usage:read", "audit_logs:read", "webhooks:manage"],
  },
];
