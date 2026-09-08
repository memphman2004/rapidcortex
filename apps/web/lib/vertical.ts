/** Agency / tenant vertical — shared by server and client surfaces. */
export type Vertical = "core" | "campus" | "venue" | "hospital" | "transit";

export {
  formatAgencyType,
  resolveAgencyVerticalFromTenant,
  type AgencyVertical,
} from "rapid-cortex-shared";

export const VERTICAL_CONFIG: Record<
  Vertical,
  { label: string; color: string; bg: string }
> = {
  core: { label: "RC Core", color: "#0284C7", bg: "rgba(2,132,199,0.15)" },
  campus: { label: "RC Campus", color: "#64748B", bg: "rgba(100,116,139,0.15)" },
  venue: { label: "RC Venue", color: "#F97316", bg: "rgba(249,115,22,0.15)" },
  hospital: { label: "RC Hospital", color: "#14B8A6", bg: "rgba(20,184,166,0.15)" },
  transit: { label: "RC Transit", color: "#818CF8", bg: "rgba(129,140,248,0.15)" },
};

/** `data-vertical` attribute values that remap shell accents in `globals.css`. */
export type VerticalThemeAttr = "campus" | "venue" | "hospital" | "transit" | "psap" | "rc-admin";

export function verticalThemeAttrFromDashboardPrefix(
  prefix: string,
): VerticalThemeAttr {
  if (prefix.startsWith("hospital")) return "hospital";
  if (prefix === "rc-admin") return "rc-admin";
  return "psap";
}

export function normalizeVertical(value: string | null | undefined): Vertical {
  const token = (value ?? "").trim().toLowerCase();
  if (token === "campus") return "campus";
  if (token === "venue") return "venue";
  if (token === "hospital") return "hospital";
  if (token === "transit") return "transit";
  return "core";
}

/** @deprecated Prefer resolveAgencyVerticalFromTenant for tenant rows. */
export function deriveVerticalFromAgencyId(agencyId: string): Vertical {
  const token = agencyId.trim().toLowerCase();
  if (token.includes("campus-")) return "campus";
  if (token.includes("venue-")) return "venue";
  if (token.includes("hospital")) return "hospital";
  if (token.includes("transit-")) return "transit";
  return "core";
}
