/**
 * In-process sliding-window burst limiter for public/token routes (CJIS abuse control).
 * Production: pair with API Gateway throttling, WAF, and/or usage plans — this provides
 * a second layer inside the Lambda and is unit-testable.
 */
export class PublicBurstLimiter {
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(maxPerWindow: number, windowMs: number) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  /** @returns true if the request is allowed, false if the burst window is exceeded. */
  allow(key: string, nowMs: number = Date.now()): boolean {
    const cutoff = nowMs - this.windowMs;
    const arr = this.hits.get(key) ?? [];
    while (arr.length > 0 && arr[0]! < cutoff) arr.shift();
    if (arr.length >= this.maxPerWindow) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(nowMs);
    this.hits.set(key, arr);
    return true;
  }
}
