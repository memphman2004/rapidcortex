export const features = {
  verticalCampus: process.env.NEXT_PUBLIC_ENABLE_VERTICAL_CAMPUS === "1",
  verticalVenue: process.env.NEXT_PUBLIC_ENABLE_VERTICAL_VENUE === "1",
  hospitalRouting: process.env.NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING === "1",
  hospitalPortal: process.env.NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL === "1",
  addonManagement: process.env.NEXT_PUBLIC_ENABLE_ADDON_MANAGEMENT === "1",
  verticalBadge: process.env.NEXT_PUBLIC_ENABLE_VERTICAL_BADGE === "1",
} as const;

export type FeatureVertical = "core" | "campus" | "venue" | "hospital";

export function isVerticalEnabled(vertical: FeatureVertical): boolean {
  if (vertical === "core") return true;
  if (vertical === "campus") return features.verticalCampus;
  if (vertical === "venue") return features.verticalVenue;
  return features.hospitalRouting || features.hospitalPortal;
}

