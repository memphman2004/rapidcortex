import { hasUnifiedWorkspace, type AgencyEntitlements } from "./products.js";

export interface GatewayIncidentContext {
  incidentId: string;
  agencyId: string;
  nature: string;
  address: string;
  priority: 1 | 2 | 3 | 4;
  units: string[];
  cadTimestamp: string;
}

export type GatewayWarn = (event: "gateway_push_failed" | "gateway_agency_mismatch", fields: Record<string, string>) => void;

/**
 * Fire-and-forget CAD context for a UNIFIED agency.
 * A failed send is a warning. It does not throw and it does not stop Core or CAD.
 * The caller agency must match the incident agency.
 */
export async function pushIncidentContext(
  entitlements: AgencyEntitlements,
  callerAgencyId: string,
  context: GatewayIncidentContext,
  send: (context: GatewayIncidentContext) => Promise<void>,
  warn: GatewayWarn,
): Promise<void> {
  if (!hasUnifiedWorkspace(entitlements)) return;
  if (context.agencyId !== callerAgencyId) {
    warn("gateway_agency_mismatch", { incidentId: context.incidentId, agencyId: callerAgencyId });
    return;
  }
  try {
    await send(context);
  } catch (error) {
    warn("gateway_push_failed", {
      incidentId: context.incidentId,
      agencyId: callerAgencyId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
