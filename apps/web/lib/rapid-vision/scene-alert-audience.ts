/**
 * Who sees the red iQ Vision pulse.
 *
 * Unassociated camera alerts go to the supervisor / watch desk.
 * A PSAP call-taker does not get that interrupt, including while a 911 call
 * is on their screen. Hiding the pulse does not acknowledge the alert.
 */

const WATCH_DESK_ROLES = new Set([
  "supervisor",
  "agencyadmin",
  "command",
  "campus_admin",
  "campus_supervisor",
  "campus_security",
  "campus_dispatch",
  "venue_admin",
  "venue_supervisor",
  "venue_security",
  "transit_admin",
  "transit_supervisor",
  "transit_security",
]);

export function normalizeVisionRole(role: string | undefined): string {
  return (role ?? "").trim().toLowerCase().replace(/-/g, "_");
}

/** PSAP 911 call-taker. Camera alerts are not routed to this console. */
export function isPsapCallTaker(role: string | undefined): boolean {
  return normalizeVisionRole(role) === "dispatcher";
}

/** Supervisor, watch desk, or security operations role. */
export function isSceneAlertWatchDesk(role: string | undefined): boolean {
  return WATCH_DESK_ROLES.has(normalizeVisionRole(role));
}

/** Live call-taker workspace. A camera alert must not surface on this screen. */
export function isActiveCallWorkspace(pathname: string | undefined): boolean {
  const segs = (pathname ?? "").split("/").filter(Boolean);
  const i = segs.indexOf("dispatcher");
  if (i < 0) return false;
  return segs[i + 1] !== "dashboard";
}

/**
 * Whether the sidebar should pulse right now.
 * A PSAP call-taker never sees it, including during a live 911 call.
 * The watch desk keeps pulsing on every screen until the alert is acknowledged.
 * Returning false does not acknowledge the alert.
 */
export function showSceneAlertPulse(input: {
  role: string | undefined;
  pathname: string | undefined;
  pulsing: boolean;
}): boolean {
  if (!input.pulsing) return false;
  if (isPsapCallTaker(input.role)) return false;
  if (isActiveCallWorkspace(input.pathname) && !isSceneAlertWatchDesk(input.role)) return false;
  if (!isSceneAlertWatchDesk(input.role)) return false;
  return true;
}
