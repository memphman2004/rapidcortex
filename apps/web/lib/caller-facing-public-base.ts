/**
 * Origin used in dispatcher-sent SMS links so the caller opens the same host
 * as the console (`/media/upload`, `/media/live`). Lambda env is the fallback
 * when this is empty (server render).
 */
export function callerFacingPublicBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}
