import type { AgencyProfileResponse } from "rapid-cortex-shared";

export type AgencyProfileVertical = "psap" | "campus" | "venue" | "hospital";

/** Normalize profile routing bucket — prefers `agencyType`, falls back to `vertical`. */
export function agencyProfileVertical(
  profile: Pick<AgencyProfileResponse, "agencyType" | "vertical">,
): AgencyProfileVertical {
  if (profile.agencyType === "venue" || profile.vertical === "venue") return "venue";
  if (profile.agencyType === "campus" || profile.vertical === "campus") return "campus";
  if (profile.agencyType === "hospital" || profile.vertical === "hospital") return "hospital";
  return "psap";
}

export function isVerticalAgencyProfile(
  profile: Pick<AgencyProfileResponse, "agencyType" | "vertical"> | null | undefined,
): profile is AgencyProfileResponse {
  if (!profile) return false;
  const v = agencyProfileVertical(profile);
  return v === "venue" || v === "campus";
}
