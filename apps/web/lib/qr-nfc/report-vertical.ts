import type { ReportVertical } from "rapid-cortex-shared";
import { deriveVerticalFromAgencyId, normalizeVertical } from "@/lib/vertical";

/** Default intake vertical when creating QR codes for an agency tenant. */
export function reportVerticalForAgency(agencyId: string, agencyVertical?: string | null): ReportVertical {
  const token = agencyVertical ? normalizeVertical(agencyVertical) : deriveVerticalFromAgencyId(agencyId);
  if (token === "campus") return "campus";
  if (token === "venue") return "venue";
  if (token === "hospital") return "hospital";
  if (token === "transit") return "transit";
  return "911";
}
