/**
 * CAD / RMS vendor cohort packaging — commercially layered on RC Lite bundles.
 */

export type RcLiteCadPartnerCapability =
  | "multi_agency_children"
  | "vendor_wide_api_keys"
  | "metered_volume_pricing"
  | "partner_sandbox_regions"
  | "custom_adapter_metadata"
  | "white_label_endpoints_optional"
  | "joint_sales_collateral";

export type RcLiteCadPartnerProgram = {
  id: "cad_vendor_partner_program";
  tagline: string;
  capabilities: readonly RcLiteCadPartnerCapability[];
  certificationBadgeIds: readonly string[];
};

export const RC_LITE_CAD_PARTNER_PROGRAM: RcLiteCadPartnerProgram = {
  id: "cad_vendor_partner_program",
  tagline: "Add AI incident intelligence to your CAD platform without building AI infrastructure yourself.",
  capabilities: [
    "multi_agency_children",
    "vendor_wide_api_keys",
    "metered_volume_pricing",
    "partner_sandbox_regions",
    "custom_adapter_metadata",
    "white_label_endpoints_optional",
    "joint_sales_collateral",
  ],
  certificationBadgeIds: [
    "rapid_cortex_verified_integration",
    "rapid_cortex_cad_ready_partner",
    "rapid_cortex_public_safety_intelligence_certified",
  ],
};
