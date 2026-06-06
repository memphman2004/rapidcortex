/** Best-effort in-memory rate limiting for Edge routes — replace with Redis in production. */

type Bucket = { count: number; resetAtMs: number };

const byTenantKey = new Map<string, Bucket>();
const TENANT_PER_MINUTE = Number(process.env.RC_LITE_RATELIMIT_TENANT_PER_MIN ?? 2400);
const KEY_PER_MINUTE = Number(process.env.RC_LITE_RATELIMIT_KEY_PER_MIN ?? 600);

function windowKey(id: string, windowMs = 60_000): string {
  return `${id}:${Math.floor(Date.now() / windowMs)}`;
}

export type RateDecision = { allowed: boolean; retryAfterSec?: number };

export function checkRcLiteRateLimit(tenantId: string, apiKeyId: string): RateDecision {
  const now = Date.now();
  const tw = `${tenantId}:t:${windowKey(tenantId)}`;
  const kw = `${tenantId}:${apiKeyId}:k:${windowKey(tenantId + apiKeyId)}`;

  let t = byTenantKey.get(tw);
  if (!t || now > t.resetAtMs) {
    t = { count: 0, resetAtMs: now + 60_000 };
  }
  let k = byTenantKey.get(kw);
  if (!k || now > k.resetAtMs) {
    k = { count: 0, resetAtMs: now + 60_000 };
  }

  if (t.count >= TENANT_PER_MINUTE || k.count >= KEY_PER_MINUTE) {
    return { allowed: false, retryAfterSec: 30 };
  }
  t.count += 1;
  k.count += 1;
  byTenantKey.set(tw, t);
  byTenantKey.set(kw, k);
  return { allowed: true };
}
