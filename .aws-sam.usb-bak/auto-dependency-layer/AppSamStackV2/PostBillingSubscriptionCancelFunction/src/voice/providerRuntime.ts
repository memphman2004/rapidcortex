import { VoiceProviderError } from "./providerErrors.js";
import { VOICE_ERROR_CODES } from "./voiceErrorCodes.js";

export function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function backoffWithJitterMs(attempt: number, baseMs: number, capMs: number): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.min(500, exp * 0.25));
  return exp + jitter;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: "stt" | "translation" | "lang_detect",
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener("abort", onOuterAbort, { once: true });
  const timeoutErr = () =>
    new VoiceProviderError(
      `${label}_timeout`,
      label === "translation"
        ? VOICE_ERROR_CODES.TRANSLATION_TIMEOUT
        : label === "lang_detect"
          ? VOICE_ERROR_CODES.LANG_DETECT_TIMEOUT
          : VOICE_ERROR_CODES.STT_TIMEOUT,
      { retryable: true },
    );
  try {
    const raced = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(timeoutErr()), { once: true });
      }),
    ]);
    return raced;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

export function isRetryableProviderError(e: unknown): boolean {
  if (e instanceof VoiceProviderError) return e.retryable;
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}
