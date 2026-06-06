import type { HospitalProfile, HospitalRecommendationLevel } from "rapid-cortex-shared";

export const RECOMMENDATION_COLORS: Record<HospitalRecommendationLevel, string> = {
  OPTIMAL: "#10B981",
  ACCEPTABLE: "#F59E0B",
  SUBOPTIMAL: "#F97316",
  NOT_RECOMMENDED: "#DC2626",
};

export const RECOMMENDATION_ICONS: Record<HospitalRecommendationLevel, string> = {
  OPTIMAL: "✅",
  ACCEPTABLE: "⚠️",
  SUBOPTIMAL: "🔶",
  NOT_RECOMMENDED: "🚫",
};

export function recommendationLabel(level: HospitalRecommendationLevel): string {
  return level.replace(/_/g, " ").toLowerCase();
}

export function formatTraumaLevel(level?: HospitalProfile["traumaLevel"] | string): string | null {
  if (!level || level === "NONE") return null;
  return level.replace("LEVEL_", "Level ");
}

export function hasTraumaCenter(profile: HospitalProfile): boolean {
  return Boolean(profile.traumaLevel && profile.traumaLevel !== "NONE");
}

export function parseAddressCityState(address: string): { city?: string; state?: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length < 2) return {};
  const stateZip = parts[parts.length - 1] ?? "";
  const city = parts[parts.length - 2];
  const state = stateZip.split(/\s+/)[0];
  return { city, state };
}
