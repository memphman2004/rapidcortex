/** Build the public Guest Assist picker URL from a QR/NFC scan. */

const GUEST_ASSIST_VERTICALS = ["venue", "campus", "transit"] as const;
export type GuestAssistVertical = (typeof GUEST_ASSIST_VERTICALS)[number];

export function guestAssistVertical(vertical: string): GuestAssistVertical {
  if (vertical === "campus" || vertical === "transit" || vertical === "venue") {
    return vertical;
  }
  return "venue";
}

export function isSafeGuestAssistBackPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://") || path.includes("\\")) return false;
  return path.startsWith("/report/") || path.startsWith("/r/");
}

export function guestAssistUrl(opts: {
  vertical: string;
  agencyName: string;
  location: string;
  agencyId?: string;
  backPath?: string;
}): string {
  const params = new URLSearchParams();
  params.set("v", guestAssistVertical(opts.vertical));
  if (opts.agencyName.trim()) params.set("name", opts.agencyName.trim());
  if (opts.location.trim()) params.set("loc", opts.location.trim());
  if (opts.agencyId?.trim()) params.set("agency", opts.agencyId.trim());
  params.set("topics", "1");
  if (opts.backPath && isSafeGuestAssistBackPath(opts.backPath)) {
    params.set("back", opts.backPath);
  }
  return `/rc-guest-assist.html?${params.toString()}`;
}
