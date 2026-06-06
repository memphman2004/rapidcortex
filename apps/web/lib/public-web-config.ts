/**
 * Values intentionally exposed to the browser (`NEXT_PUBLIC_*`).
 *
 * Anything **server-authoritative** — API keys, JWT signing secrets, webhook HMAC secrets, STS keys — must remain in
 * `apps/api` env / Secrets Manager only and must never ship under `NEXT_PUBLIC_` prefixes.
 * Used on Admin → Configuration for honest operator visibility (not secrets).
 */
export type PublicConfigRow = {
  key: string;
  value: string;
  note?: string;
};

function envOrUnset(key: string): string {
  if (typeof process === "undefined") return "—";
  const v = process.env[key];
  if (v == null || String(v).trim() === "") return "(unset)";
  return String(v);
}

export function getPublicWebConfigurationRows(): PublicConfigRow[] {
  return [
    { key: "NEXT_PUBLIC_SITE_URL", value: envOrUnset("NEXT_PUBLIC_SITE_URL") },
    { key: "NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG", value: envOrUnset("NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG") },
    { key: "NEXT_PUBLIC_APP_ENV", value: envOrUnset("NEXT_PUBLIC_APP_ENV") },
    {
      key: "NEXT_PUBLIC_AUTH_PROXY",
      value: envOrUnset("NEXT_PUBLIC_AUTH_PROXY"),
      note: "1 = cookie BFF to API",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP"),
      note: "0 = staff/admin-only provisioning (recommended)",
    },
    {
      key: "NEXT_PUBLIC_API_BASE",
      value: envOrUnset("NEXT_PUBLIC_API_BASE"),
      note: "Direct browser → API when set (omit if using proxy)",
    },
    {
      key: "NEXT_PUBLIC_API_BASE_2",
      value: envOrUnset("NEXT_PUBLIC_API_BASE_2"),
      note: "Optional second SAM HttpApi (comms/platform); see lib/comms-api-path.ts",
    },
    {
      key: "NEXT_PUBLIC_OFFLINE_DEMO_MODE",
      value: envOrUnset("NEXT_PUBLIC_OFFLINE_DEMO_MODE"),
      note: "Must be unset on real pilot hosts",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM"),
      note: "Dashboard scripted transcript toolbar",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_QA_SCORING",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_QA_SCORING"),
      note: "1 = QA sessions, templates, supervisor QA workspace",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA"),
      note: "1 = incident caller media request + gallery",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_CALLER_MEDIA",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_CALLER_MEDIA"),
      note: "Alias of NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA for ops naming",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_LIVE_VIDEO",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_LIVE_VIDEO"),
      note: "1 = caller live video request + dispatcher stream viewer",
    },
    {
      key: "NEXT_PUBLIC_ENABLE_CALLER_CARD",
      value: envOrUnset("NEXT_PUBLIC_ENABLE_CALLER_CARD"),
      note: "1 = F7 caller / premise card (align with API ENABLE_CALLER_CARD)",
    },
    {
      key: "NEXT_PUBLIC_DOCUMENTATION_BASE_URL",
      value: envOrUnset("NEXT_PUBLIC_DOCUMENTATION_BASE_URL"),
      note: "Hosted docs root for Pilot hub links",
    },
    { key: "NEXT_PUBLIC_COGNITO_REGION", value: envOrUnset("NEXT_PUBLIC_COGNITO_REGION") },
    { key: "NEXT_PUBLIC_COGNITO_USER_POOL_ID", value: envOrUnset("NEXT_PUBLIC_COGNITO_USER_POOL_ID") },
    { key: "NEXT_PUBLIC_COGNITO_CLIENT_ID", value: envOrUnset("NEXT_PUBLIC_COGNITO_CLIENT_ID") },
  ];
}
