import type { NextRequest } from "next/server";
import type { RcLiteApiScope } from "rapid-cortex-shared";
import { RC_LITE_API_SCOPES } from "rapid-cortex-shared";
import { verifyRcLiteApiKey } from "./hash-api-key";

export type VerifiedRcLiteKeyOk = {
  ok: true;
  tenantId: string;
  keyId: string;
  /** Hashed lookups would union scopes assigned to this key in Dynamo/API service. */
  scopes: ReadonlySet<RcLiteApiScope>;
  environment: "sandbox" | "production";
};

export type VerifiedRcLiteKeyFail =
  | {
      ok: false;
      error: string;
      failureReason: "missing" | "not_configured" | "invalid" | "revoked";
    };

const ALL_SCOPES: ReadonlySet<RcLiteApiScope> = new Set(RC_LITE_API_SCOPES);

/**
 * Validates `X-RC-API-Key` or `Authorization: Bearer rk_*`.
 *
 * Production: replace with KMS-backed secret material + Dynamo rows (hashed secrets only).
 * Development/tests: deterministic keys documented in `/developers/docs/authentication`.
 */
export async function verifyRcLiteApiRequest(request: NextRequest): Promise<VerifiedRcLiteKeyOk | VerifiedRcLiteKeyFail> {
  const bearer = request.headers.get("authorization");
  const direct = request.headers.get("x-rc-api-key") ?? "";
  const raw =
    bearer && bearer.trim().toLowerCase().startsWith("bearer ") ? bearer.replace(/^Bearer\s+/i, "").trim() : direct.trim();

  if (!raw.length) {
    return { ok: false, error: "Provide X-RC-API-Key or Authorization: Bearer.", failureReason: "missing" };
  }

  const allowDev =
    process.env.NODE_ENV === "development" || process.env.ALLOW_RC_LITE_DEV_KEYS?.trim().toLowerCase() === "true";

  if (allowDev && raw === "rk_test_revoked") {
    return { ok: false, error: "This API key was revoked.", failureReason: "revoked" };
  }

  if (allowDev && raw.startsWith("rk_test_")) {
    const tenantId = process.env.RC_LITE_DEV_TENANT_ID?.trim() || "tenant_dev";
    return {
      ok: true,
      tenantId,
      keyId: "rk_test_preview",
      scopes: ALL_SCOPES,
      environment: raw.includes("_prod") ? "production" : "sandbox",
    };
  }

  const canaryHash = process.env.RC_LITE_CANARY_HASH_HEX?.trim();
  if (allowDev && canaryHash && verifyRcLiteApiKey(raw, canaryHash)) {
    return {
      ok: true,
      tenantId: process.env.RC_LITE_CANARY_TENANT_ID?.trim() || "tenant_hmac_canary",
      keyId: "rk_hmac_preview",
      scopes: ALL_SCOPES,
      environment: process.env.RC_LITE_CANARY_ENVIRONMENT === "production" ? "production" : "sandbox",
    };
  }

  return {
    ok: false,
    error: "Provisioning service not configured for hashed API keys on this host.",
    failureReason: "not_configured",
  };
}
