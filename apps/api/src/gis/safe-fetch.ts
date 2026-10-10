import { assertSafeFetchUrl, SsrfBlockedError } from "../services/seo/ssrfGuard.js";

/** GIS external fetch: HTTPS only + SSRF DNS checks before any network call. */
export async function assertGisSafeHttpsUrl(rawUrl: string): Promise<URL> {
  const u = await assertSafeFetchUrl(rawUrl);
  if (u.protocol !== "https:") {
    throw new SsrfBlockedError("HTTPS_REQUIRED");
  }
  return u;
}

export async function gisSafeFetch(
  rawUrl: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const u = await assertGisSafeHttpsUrl(rawUrl);
  const timeoutMs = init?.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _t, ...rest } = init ?? {};
    return await fetch(u.toString(), {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "NexCortIQ-GISConnector/1.0",
        ...(rest.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export { SsrfBlockedError };
