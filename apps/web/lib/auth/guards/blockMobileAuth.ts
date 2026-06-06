import { logMobileAuthBlocked } from "@/lib/audit/log-mobile-auth-blocked";
import {
  isMobileOperationalAuthBlockingEnabled,
  shouldBlockAuthOnDevice,
} from "@/lib/device/isMobileRequest";
import { pathnameIsMobileOperationalBlockedApi } from "@/lib/device/operations-mobile-blocklist";

/**
 * Blocks auth / operational BFF API calls from mobile/tablet browsers when enforcement is enabled.
 * Returns non-null Response with 403 JSON when blocked.
 */
export function blockMobileAuthRequest(request: Request): Response | null {
  if (!isMobileOperationalAuthBlockingEnabled()) return null;

  const url = new URL(request.url);
  if (!pathnameIsMobileOperationalBlockedApi(url.pathname)) return null;

  const ua = request.headers.get("user-agent");
  if (!shouldBlockAuthOnDevice(ua)) return null;

  logMobileAuthBlocked(url.pathname, request.headers as Headers, ua);

  return Response.json(
    {
      error: "mobile_auth_blocked",
      message: "Rapid Cortex console login is restricted to approved desktop workstations.",
    },
    { status: 403 },
  );
}
