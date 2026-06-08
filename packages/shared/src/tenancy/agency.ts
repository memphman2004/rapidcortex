import type { AgencyConfig, AgencyIntegrationMode } from "./agency-config.js";
import type { AgencyNetworkPolicy } from "../network/access-policy-types.js";

export type AgencyType =
  | "city"
  | "county"
  | "municipality"
  | "regional_center"
  | "pilot"
  | "state_agency"
  | "venue"
  | "campus";

/** Product agency-type values (PSAP governance / billing segmentation). */
export const AGENCY_TYPE_VALUES = [
  "city",
  "county",
  "municipality",
  "regional_center",
  "pilot",
  "state_agency",
  "venue",
  "campus",
] as const satisfies readonly AgencyType[];

export const AGENCY_TYPE_LABELS: Record<AgencyType, string> = {
  city: "City",
  county: "County",
  municipality: "Municipality",
  regional_center: "Regional Center",
  pilot: "Pilot",
  state_agency: "State Agency",
  venue: "Venue",
  campus: "Campus",
};

export function formatAgencyType(type: AgencyType | string): string {
  const token = type as AgencyType;
  return AGENCY_TYPE_LABELS[token] ?? type.replace(/_/g, " ");
}

export type AgencyLifecycleStatus = "draft" | "pilot" | "active" | "suspended" | "archived";

export type AgencyDeploymentMode = "side_by_side" | "partially_integrated" | "integrated";
export type AgencyVertical = "core" | "campus" | "venue" | "hospital";
export type AgencyPlanTier = "starter" | "professional" | "command" | "enterprise";

/**
 * Full tenant (city / municipality / ECC) record — Dynamo primary item for the agency.
 */
export interface AgencyTenant {
  agencyId: string;
  /** Product vertical for tenant routing and RC admin segmentation. */
  vertical?: AgencyVertical;
  /** Enabled add-on keys mirrored to Cognito `custom:addons` for session routing. */
  addons?: string[];
  /** Marketing/commercial plan bucket (quote-based tiers). */
  planTier?: AgencyPlanTier;
  /** Pilot gating flag for activation / entitlement defaults. */
  pilotMode?: boolean;
  name: string;
  type: AgencyType;
  status: AgencyLifecycleStatus;
  state: string;
  /**
   * PSAP locality + canonical center name — required on `createAgencyBodySchema`
   * and used to derive `agencyId`. Optional on the type to keep rows written
   * before the May 2026 fix readable.
   */
  city?: string;
  centerName?: string;
  region: string;
  primaryContactName: string;
  primaryContactEmail: string;
  deploymentMode: AgencyDeploymentMode;
  protocolPackId: string;
  retentionPolicyId: string;
  integrationMode: AgencyIntegrationMode;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  /** Embedded v1 config — split to child item later without API churn. */
  config: AgencyConfig;
  /** Procurement / entitlement billing row (Dynamo is schemaless; omit in older rows). */
  billingStatus?: "draft" | "active" | "past_due" | "suspended" | "canceled";
  subscriptionStatus?:
    | "none"
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete";
  monetizationPlanId?: string;
  monetizationAddOnIds?: string[];
  /** Mirrors `monetizationPlanId` for procurement rows — optional duplicate. */
  planId?: string;
  /** External procurement / finance correlator — optional; legacy Dynamo may store older attribute names (normalized on read). */
  externalBillingCustomerId?: string;
  externalBillingSubscriptionId?: string;
  paymentMethod?:
    | "invoice"
    | "purchase_order"
    | "custom_contract"
    | "manual"
    | "gov_po_net_terms";
  billingContactName?: string;
  billingContactEmail?: string;
  billingAddress?: string;
  purchaseOrderNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  renewalDate?: string;
  usageBillingFrequency?: "monthly" | "quarterly" | "annually";
  /** Serialized map of MonetizationFeatureKey → boolean — RC Admin pilots / holds. */
  monetizationFeatureOverridesJson?: string;
  /** Per-agency IP allowlist + shift-hour access control (opt-in). */
  networkPolicy?: AgencyNetworkPolicy;
}

export function resolveAgencyVerticalFromTenant(
  agency: Pick<AgencyTenant, "agencyId" | "type"> & { vertical?: AgencyVertical | string },
): AgencyVertical {
  if (agency.vertical) {
    const token = String(agency.vertical).trim().toLowerCase();
    if (token === "campus" || token === "venue" || token === "hospital") return token;
    return "core";
  }
  if (agency.type === "venue") return "venue";
  if (agency.type === "campus") return "campus";
  const token = agency.agencyId.trim().toLowerCase();
  if (token.includes("campus-")) return "campus";
  if (token.includes("venue-")) return "venue";
  if (token.includes("hospital")) return "hospital";
  return "core";
}
