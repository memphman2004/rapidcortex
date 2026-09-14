import { VIDEO_PTZ_RATE_LIMIT_PER_MINUTE } from "rapid-cortex-shared";

const windows = new Map<string, number[]>();

export function ptzRateLimitKey(agencyId: string, userId: string, cameraId: string): string {
  return `${agencyId.trim()}:${userId.trim()}:${cameraId.trim()}`;
}

/** Best-effort per-Lambda sliding window. Returns false when the caller should receive 429. */
export function consumePtzRateLimit(
  key: string,
  nowMs = Date.now(),
  limit = VIDEO_PTZ_RATE_LIMIT_PER_MINUTE,
  windowMs = 60_000,
): boolean {
  const cutoff = nowMs - windowMs;
  const prev = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (prev.length >= limit) {
    windows.set(key, prev);
    return false;
  }
  prev.push(nowMs);
  windows.set(key, prev);
  return true;
}

export function resetPtzRateLimitForTests(): void {
  windows.clear();
}
