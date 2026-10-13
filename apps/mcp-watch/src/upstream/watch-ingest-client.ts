import type { WatchSignal } from "rapid-cortex-shared";

export type UpstreamSuccess = {
  success: true;
  action: "created" | "updated" | "unchanged";
  signal_id: string;
  external_key: string;
  lifecycle_event_created: boolean;
  possible_duplicate?: boolean;
  possible_duplicate_of?: string;
  priority_score?: number;
  priority_label?: string;
};

export type UpstreamFailure = {
  success: false;
  error: "VALIDATION_ERROR" | "UNAUTHORIZED" | "UPSTREAM_ERROR" | "NETWORK_ERROR";
  status?: number;
  message: string;
  details?: unknown;
  retryable: boolean;
};

export type UpstreamResult = UpstreamSuccess | UpstreamFailure;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export type IngestClientOpts = {
  baseUrl: string;
  apiKey: string;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
};

/**
 * POST one WatchSignal to the existing ingest API.
 * Retries only temporary failures with bounded exponential backoff.
 * Never retries 401/403/400 or invalid JSON. Preserves the same body (external_key).
 */
export async function postWatchIngest(
  signal: WatchSignal,
  opts: IngestClientOpts,
): Promise<UpstreamResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${opts.baseUrl.replace(/\/$/, "")}/api/watch/ingest`;
  const body = JSON.stringify(signal);

  let lastFailure: UpstreamFailure | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
          "x-nexcort-watch-key": opts.apiKey,
        },
        body,
      });

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        if (isRetryableStatus(res.status) && attempt < maxAttempts) {
          await sleep(200 * 2 ** (attempt - 1));
          continue;
        }
        return {
          success: false,
          error: "UPSTREAM_ERROR",
          status: res.status,
          message: "Upstream returned non-JSON body",
          retryable: false,
        };
      }

      if (res.ok && json && typeof json === "object" && (json as { success?: boolean }).success === true) {
        return json as UpstreamSuccess;
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: "UNAUTHORIZED",
          status: res.status,
          message: "Upstream rejected ingest API key",
          retryable: false,
        };
      }

      if (res.status === 400) {
        return {
          success: false,
          error: "VALIDATION_ERROR",
          status: 400,
          message: "Upstream validation failed",
          details: json,
          retryable: false,
        };
      }

      lastFailure = {
        success: false,
        error: "UPSTREAM_ERROR",
        status: res.status,
        message: `Upstream HTTP ${res.status}`,
        details: json,
        retryable: isRetryableStatus(res.status),
      };

      if (lastFailure.retryable && attempt < maxAttempts) {
        await sleep(200 * 2 ** (attempt - 1));
        continue;
      }
      return lastFailure;
    } catch (err) {
      lastFailure = {
        success: false,
        error: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
        retryable: true,
      };
      if (attempt < maxAttempts) {
        await sleep(200 * 2 ** (attempt - 1));
        continue;
      }
      return lastFailure;
    }
  }

  return (
    lastFailure ?? {
      success: false,
      error: "UPSTREAM_ERROR",
      message: "Exhausted retries",
      retryable: false,
    }
  );
}
