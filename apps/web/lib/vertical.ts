/** Agency / tenant vertical — shared by server and client surfaces. */
export type Vertical = "core" | "campus" | "venue" | "hospital";

export const VERTICAL_CONFIG: Record<
  Vertical,
  { label: string; color: string; bg: string }
> = {
  core: { label: "RC Core", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  campus: { label: "RC Campus", color: "#34D399", bg: "rgba(52,211,153,0.15)" },
  venue: { label: "RC Venue", color: "#FB923C", bg: "rgba(251,146,60,0.15)" },
  hospital: { label: "RC Hospital", color: "#F9A8D4", bg: "rgba(249,168,212,0.15)" },
};

export function normalizeVertical(value: string | null | undefined): Vertical {
  const token = (value ?? "").trim().toLowerCase();
  if (token === "campus") return "campus";
  if (token === "venue") return "venue";
  if (token === "hospital") return "hospital";
  return "core";
}

export function deriveVerticalFromAgencyId(agencyId: string): Vertical {
  const token = agencyId.trim().toLowerCase();
  if (token.includes("campus-")) return "campus";
  if (token.includes("venue-")) return "venue";
  if (token.includes("hospital")) return "hospital";
  return "core";
}
