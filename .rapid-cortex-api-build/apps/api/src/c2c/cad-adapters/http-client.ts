import { AdapterError } from "./adapter.interface.js";

export class AdapterDisabledError extends AdapterError {
  constructor(agencyId: string, method: string, reason: string) {
    super(`[${agencyId}] ${method}() skipped — ${reason}`, agencyId, method);
    this.name = "AdapterDisabledError";
  }
}

export interface CadHttpClientOptions {
  agencyId: string;
  baseUrl: string;
  timeoutMs: number;
  headers: () => Promise<Record<string, string>>;
}

export class CadHttpClient {
  constructor(private readonly opts: CadHttpClientOptions) {}

  get ready(): boolean {
    return /^https?:\/\//i.test(this.opts.baseUrl.trim());
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    options?: { query?: Record<string, string | undefined>; body?: unknown },
  ): Promise<T> {
    if (!this.ready) {
      throw new AdapterDisabledError(
        this.opts.agencyId,
        `${method} ${path}`,
        "no CAD API base URL yet — add the vendor URL and credentials to Secrets Manager to turn this slot on",
      );
    }
    const url = new URL(path.replace(/^\//, ""), this.opts.baseUrl.endsWith("/") ? this.opts.baseUrl : `${this.opts.baseUrl}/`);
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value) url.searchParams.set(key, value);
    }
    const headers = await this.opts.headers();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: options?.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (cause) {
      throw new AdapterError(
        `[${this.opts.agencyId}] ${method} ${url.pathname} failed to reach CAD`,
        this.opts.agencyId,
        method,
        cause instanceof Error ? cause : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AdapterError(
        `[${this.opts.agencyId}] ${method} ${url.pathname} returned HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        this.opts.agencyId,
        method,
      );
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}
