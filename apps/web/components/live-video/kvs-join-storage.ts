/**
 * Retry policy for JoinStorageSession / JoinStorageSessionAsViewer.
 * AWS returns 200 before the storage peer always sends SDP; callers retry until an offer arrives.
 */

export const JOIN_STORAGE_MAX_ATTEMPTS = 8;
export const JOIN_STORAGE_BASE_DELAY_MS = 2000;

export function shouldRetryJoinStorageSession(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const code = e.name ?? e.code ?? "";
  const message = (e.message ?? "").toLowerCase();
  if (code === "ClientLimitExceededException" && message.includes("maximum number of viewers")) {
    return false;
  }
  if (code === "ClientLimitExceededException") return true;
  if (code === "NetworkingError" || code === "TimeoutError") return true;
  if (e.$metadata?.httpStatusCode === 500) return true;
  return false;
}

export function joinStorageAttemptDelayMs(attemptIndex: number): number {
  const jitter = Math.min(10_000, Math.random() * 200 * attemptIndex ** 2);
  return JOIN_STORAGE_BASE_DELAY_MS + jitter;
}

export async function joinStorageSessionUntilOffer(opts: {
  sendJoin: () => Promise<void>;
  isOfferReceived: () => boolean;
  isStopped: () => boolean;
  maxAttempts?: number;
  delayMs?: (attemptIndex: number) => number;
}): Promise<boolean> {
  const maxAttempts = opts.maxAttempts ?? JOIN_STORAGE_MAX_ATTEMPTS;
  const delayMs = opts.delayMs ?? joinStorageAttemptDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.isStopped() || opts.isOfferReceived()) return opts.isOfferReceived();
    try {
      await opts.sendJoin();
    } catch (err) {
      if (!shouldRetryJoinStorageSession(err)) return false;
    }
    if (opts.isOfferReceived()) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs(attempt)));
  }
  return opts.isOfferReceived();
}
