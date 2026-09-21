import { isStaffGuideEnabled } from "@/lib/runtime-flags";
import { staffGuideVerticalFromRole, type StaffGuideVertical } from "./catalog";

const ROLE_SEGMENT = new Set([
  "admin",
  "supervisor",
  "security",
  "operator",
  "guest",
  "dispatch",
]);

function codeFromAgency(agencyId: string, kind: "campus" | "venue" | "transit"): string {
  const raw = agencyId.trim();
  const re =
    kind === "campus"
      ? /(?:test-)?campus-(.+)$/i
      : kind === "venue"
        ? /(?:test-)?venue-(.+)$/i
        : /(?:test-)?transit-(.+)$/i;
  const match = raw.match(re);
  return (match?.[1] ?? "").toUpperCase().replace(/-/g, "");
}

function firstPathCode(pathname: string, vertical: StaffGuideVertical): string | null {
  const re =
    vertical === "campus"
      ? /\/(?:app\/)?campus\/([^/?#]+)/i
      : vertical === "venue"
        ? /\/(?:app\/)?venue\/([^/?#]+)/i
        : /\/(?:app\/)?transit\/([^/?#]+)/i;
  const match = pathname.match(re);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  if (ROLE_SEGMENT.has(raw.toLowerCase())) return null;
  return raw;
}

function staffGuidePath(vertical: StaffGuideVertical, code: string): string {
  const safe = encodeURIComponent(code);
  if (vertical === "campus") return `/app/campus/${safe}/staff-guide`;
  if (vertical === "venue") return `/app/venue/${safe}/staff-guide`;
  return `/transit/${safe}/staff-guide`;
}

/**
 * Staff Guide URL for campus / venue / transit roles.
 * PSAP (911) roles return null so they keep the Help tab.
 */
export function resolveStaffGuideHref(opts: {
  role?: string;
  agencyId?: string;
  pathname?: string;
}): string | null {
  if (!isStaffGuideEnabled()) return null;
  const vertical = staffGuideVerticalFromRole(opts.role ?? "");
  if (!vertical) return null;

  const fromPath = firstPathCode(opts.pathname ?? "", vertical);
  const agency = (opts.agencyId ?? "").trim();
  const fromAgency =
    vertical === "campus"
      ? codeFromAgency(agency, "campus")
      : vertical === "venue"
        ? codeFromAgency(agency, "venue")
        : codeFromAgency(agency, "transit");
  const code = fromPath || fromAgency;
  if (code) return staffGuidePath(vertical, code);
  return "/staff-guide";
}
