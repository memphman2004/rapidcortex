import { isPilotTestModeEnabled } from "./pilot-test-mode";

function productFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  if (isPilotTestModeEnabled()) return true;
  return true;
}

export const features = {
  verticalCampus: productFlag("NEXT_PUBLIC_ENABLE_VERTICAL_CAMPUS"),
  verticalVenue: productFlag("NEXT_PUBLIC_ENABLE_VERTICAL_VENUE"),
  hospitalRouting: productFlag("NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING"),
  hospitalPortal: productFlag("NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL"),
  addonManagement: productFlag("NEXT_PUBLIC_ENABLE_ADDON_MANAGEMENT"),
  verticalBadge: productFlag("NEXT_PUBLIC_ENABLE_VERTICAL_BADGE"),
} as const;

export type FeatureVertical = "core" | "campus" | "venue" | "hospital";

export function isVerticalEnabled(vertical: FeatureVertical): boolean {
  if (vertical === "core") return true;
  if (vertical === "campus") return features.verticalCampus;
  if (vertical === "venue") return features.verticalVenue;
  return features.hospitalRouting || features.hospitalPortal;
}
