/** Canonical product plans (marketing + Dynamo `planId`). */
export type MonetizationPlanId =
  | "essential"
  | "command"
  | "enterprise_statewide"
  | "rc_lite";

/** Add-on SKU ids (Dynamo `addOnId`). */
export type MonetizationAddOnId =
  | "cad_integration"
  | "ai_call_intelligence"
  | "transcription_translation"
  | "caller_media"
  | "supervisor_qa"
  | "api_access"
  | "premium_support"
  | "onsite_deployment_training"
  | "setup_implementation_fee";

export type MonetizationBillingType = "monthly" | "annual" | "custom" | "pilot";

export type AgencyPaymentMethodType =
  | "invoice"
  | "purchase_order"
  | "custom_contract"
  | "manual"
  | "gov_po_net_terms";
