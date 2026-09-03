import type { UserContext } from "rapid-cortex-shared/types";
import {
  extractCampusCode,
  extractVenueCode,
  extractTransitCode,
} from "@/lib/auth/post-login-redirect";
import type { NavContext } from "./role-nav";

export { extractCampusCode, extractVenueCode, extractTransitCode };

export function buildNavContext(
  user: Pick<UserContext, "agencyId">,
  jurisdiction?: string,
): NavContext {
  const agencyId = user.agencyId?.trim() ?? "";
  return {
    jurisdiction,
    venueCode: agencyId ? extractVenueCode(agencyId) : undefined,
    campusCode: agencyId ? extractCampusCode(agencyId) : undefined,
    transitCode: agencyId ? extractTransitCode(agencyId) : undefined,
  };
}
