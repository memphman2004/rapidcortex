function parseBooleanFlag(raw: string | undefined, defaultValue = false): boolean {
  if (raw === undefined || raw === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}

function requireNonEmpty(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(
      `Ring integration is enabled but required environment variable ${name} is missing or empty.`,
    );
  }
  return trimmed;
}

export const RING_PARTNERSHIP_ENABLED = parseBooleanFlag(process.env.RING_PARTNERSHIP_ENABLED, false);
export const ENABLE_CONNECT_RING = parseBooleanFlag(process.env.ENABLE_CONNECT_RING, false);
export const ENABLE_CONNECT_RING_AVAILABLE_CAMERAS = parseBooleanFlag(
  process.env.ENABLE_CONNECT_RING_AVAILABLE_CAMERAS,
  false,
);
export const ENABLE_CONNECT_RING_EMERGENCY_REQUESTS = parseBooleanFlag(
  process.env.ENABLE_CONNECT_RING_EMERGENCY_REQUESTS,
  false,
);

export const RING_REDIRECT_URI =
  process.env.RING_REDIRECT_URI?.trim() ??
  "https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/integrations/ring/callback";

/**
 * Partner-initiated authorize endpoint (Ring Appstore).
 * `oauth.ring.com/oauth/authorize` + `scope=client` is the unofficial consumer API
 * and is rejected for Rapid Cortex Connect (`invalid_scope` / client-scope validation).
 */
export const RING_OAUTH_AUTHORIZE_URL =
  process.env.RING_OAUTH_AUTHORIZE_URL?.trim() ||
  "https://account.ring.com/account/integrations/partner-link/authorize";

/** Only `ava.v1:read` is supported for partner-initiated linking. */
export const RING_OAUTH_SCOPE = process.env.RING_OAUTH_SCOPE?.trim() || "ava.v1:read";

/** OAuth redirect for citizen (non-staff) Ring linking — separate callback route. */
export const RING_CITIZEN_REDIRECT_URI =
  process.env.RING_CITIZEN_REDIRECT_URI?.trim() ??
  RING_REDIRECT_URI.replace(/\/api\/integrations\/ring\/callback\/?$/, "/api/public/ring/oauth/callback");
export const RING_ACCOUNT_LINK_URL =
  process.env.RING_ACCOUNT_LINK_URL?.trim() ??
  "https://www.rapidcortex.us/connect/ring/link";
export const RING_WEBHOOK_URL =
  process.env.RING_WEBHOOK_URL?.trim() ??
  "https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/webhook";
export const RING_SECRETS_PREFIX =
  process.env.RING_SECRETS_PREFIX?.trim() ?? "rapid-cortex/connect/ring";
export const RING_KMS_KEY_ID = process.env.RING_KMS_KEY_ID?.trim() ?? "";

/** Agency that receives Appstore-linked homeowner devices (pilot default: test-agency). */
export const RING_HOMEOWNER_DEFAULT_AGENCY_ID =
  process.env.RING_HOMEOWNER_DEFAULT_AGENCY_ID?.trim() || "test-agency";

/**
 * Fallback GPS when Ring device discovery omits lat/lng.
 *
 * Model:
 * - Ring Location address → used at Appstore registration / validation (coarse place).
 * - Rapid Cortex incident map pin → precise proximity search center.
 * - Device lat/lng in RapidCortexRingDevices (seeded/fallback) → eligible cameras near the pin.
 * Multiple cameras at one Ring Location share that property; we stamp the same fallback GPS
 * when Ring omits coordinates (Ring only exposes country/state, not precise GPS).
 *
 * Default: Columbus, GA Sonoma Pointe pilot (32.5369, -84.9274). Override via env.
 */
export const RING_HOMEOWNER_FALLBACK_LATITUDE = (() => {
  const n = Number.parseFloat(process.env.RING_HOMEOWNER_FALLBACK_LATITUDE ?? "");
  return Number.isFinite(n) ? n : 32.5369;
})();
export const RING_HOMEOWNER_FALLBACK_LONGITUDE = (() => {
  const n = Number.parseFloat(process.env.RING_HOMEOWNER_FALLBACK_LONGITUDE ?? "");
  return Number.isFinite(n) ? n : -84.9274;
})();

export function isRingEnabled(): boolean {
  return ENABLE_CONNECT_RING && RING_PARTNERSHIP_ENABLED;
}

export function isRingAvailableCamerasEnabled(): boolean {
  return ENABLE_CONNECT_RING && ENABLE_CONNECT_RING_AVAILABLE_CAMERAS;
}

export function isRingEmergencyRequestsEnabled(): boolean {
  return ENABLE_CONNECT_RING && ENABLE_CONNECT_RING_EMERGENCY_REQUESTS;
}

function ringCoreEnabled(): boolean {
  return (
    RING_PARTNERSHIP_ENABLED &&
    (ENABLE_CONNECT_RING ||
      ENABLE_CONNECT_RING_AVAILABLE_CAMERAS ||
      ENABLE_CONNECT_RING_EMERGENCY_REQUESTS)
  );
}

/** Validates required Ring env when any Ring feature flag is on. Call at Lambda cold start. */
export function assertRingEnvWhenEnabled(): void {
  if (!ringCoreEnabled()) return;

  const credentialsArn =
    process.env.RING_CREDENTIALS_SECRET_ARN?.trim() ||
    process.env.RING_PARTNER_TOKEN_SECRET_ARN?.trim();
  requireNonEmpty("RING_CREDENTIALS_SECRET_ARN", credentialsArn);
  requireNonEmpty("RING_REDIRECT_URI", process.env.RING_REDIRECT_URI);
  requireNonEmpty("RING_CITIZEN_REDIRECT_URI", process.env.RING_CITIZEN_REDIRECT_URI ?? RING_CITIZEN_REDIRECT_URI);
  requireNonEmpty("RING_ACCOUNT_LINK_URL", process.env.RING_ACCOUNT_LINK_URL);
  requireNonEmpty("RING_WEBHOOK_URL", process.env.RING_WEBHOOK_URL);
  requireNonEmpty("RING_SECRETS_PREFIX", process.env.RING_SECRETS_PREFIX);
}
