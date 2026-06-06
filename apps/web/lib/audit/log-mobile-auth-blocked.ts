import { hashUserAgentFingerprint } from "@/lib/device/privacy-hash";

export type MobileAuthBlockedPayload = {
  eventType: "mobile_auth_blocked";
  route: string;
  timestamp: string;
  userAgentHash: string;
  userAgentFamily: string;
  ipHash?: string;
  requestId?: string;
};

function pickUserAgentFamily(ua: string): string {
  const low = ua.toLowerCase();
  if (/iphone/i.test(ua)) return "iphone";
  if (/ipad/i.test(ua)) return "ipad";
  if (/ipod/i.test(ua)) return "ipod";
  if (/android/i.test(low)) return "android";
  if (/windows phone|iemobile/i.test(low)) return "windows_mobile";
  if (/macintosh/i.test(low) && /\bsafari/i.test(low)) return "mac_safari";
  if (/windows/i.test(low)) return "windows";
  return "other";
}

/**
 * Structured, privacy-preserving observability — no cookies, tokens, or raw PII beyond route path.
 */
export function logMobileAuthBlocked(
  pathname: string,
  headers: { get(name: string): string | null },
  userAgent: string | null,
): MobileAuthBlockedPayload {
  const ua = userAgent ?? "";
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const entry: MobileAuthBlockedPayload = {
    eventType: "mobile_auth_blocked",
    route: pathname,
    timestamp: new Date().toISOString(),
    userAgentHash: ua ? hashUserAgentFingerprint(ua) : "",
    userAgentFamily: ua ? pickUserAgentFamily(ua) : "empty",
  };
  const reqId =
    headers.get("x-request-id") ||
    headers.get("x-correlation-id") ||
    headers.get("x-amzn-trace-id");
  if (reqId) entry.requestId = hashUserAgentFingerprint(reqId).slice(0, 24);
  if (fwd && fwd.length > 0) entry.ipHash = hashUserAgentFingerprint(fwd).slice(0, 24);

  if (typeof console !== "undefined" && console.info) {
    console.info(JSON.stringify(entry));
  }
  return entry;
}
