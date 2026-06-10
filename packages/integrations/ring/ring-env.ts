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
export const RING_ACCOUNT_LINK_URL =
  process.env.RING_ACCOUNT_LINK_URL?.trim() ??
  "https://app.rapidcortex.us/app/venue/MBS/cameras";
export const RING_WEBHOOK_URL =
  process.env.RING_WEBHOOK_URL?.trim() ?? "https://api.rapidcortex.us/api/integrations/ring/webhook";
export const RING_SECRETS_PREFIX =
  process.env.RING_SECRETS_PREFIX?.trim() ?? "rapid-cortex/connect/ring";
export const RING_KMS_KEY_ID = process.env.RING_KMS_KEY_ID?.trim() ?? "";

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
  requireNonEmpty("RING_ACCOUNT_LINK_URL", process.env.RING_ACCOUNT_LINK_URL);
  requireNonEmpty("RING_WEBHOOK_URL", process.env.RING_WEBHOOK_URL);
  requireNonEmpty("RING_SECRETS_PREFIX", process.env.RING_SECRETS_PREFIX);
}
