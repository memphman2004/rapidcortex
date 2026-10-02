import { z } from "zod";

export const cadPollTestConnectionBodySchema = z.object({
  apiUrl: z.string().min(1).max(2000),
  authType: z.enum(["bearer", "api_key_header", "basic", "no_auth"]).default("bearer"),
  apiKey: z.string().max(4096).optional(),
  apiKeyHeader: z.string().max(120).optional(),
  agencyCode: z.string().max(120).optional(),
});

export type CadPollTestConnectionInput = z.infer<typeof cadPollTestConnectionBodySchema>;

export type CadPollTestConnectionResult = {
  ok: boolean;
  latencyMs: number;
  sampleCount: number;
  error?: string;
  statusCode?: number;
};

function buildPollUrl(apiUrl: string, agencyCode?: string): string {
  const trimmed = apiUrl.trim().replace(/\/$/, "");
  const hasIncidents = /\/incidents(\?|$)/i.test(trimmed);
  const base = hasIncidents ? trimmed : `${trimmed}/incidents`;
  const u = new URL(base);
  if (!u.searchParams.has("since")) {
    u.searchParams.set("since", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }
  if (agencyCode?.trim() && !u.searchParams.has("agency") && !u.searchParams.has("agencyCode")) {
    u.searchParams.set("agency", agencyCode.trim());
  }
  return u.toString();
}

function authHeaders(input: CadPollTestConnectionInput): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = input.apiKey?.trim() ?? "";
  if (input.authType === "no_auth" || !key) return headers;
  if (input.authType === "bearer") headers.Authorization = `Bearer ${key}`;
  else if (input.authType === "basic") headers.Authorization = `Basic ${key}`;
  else headers[input.apiKeyHeader?.trim() || "X-Api-Key"] = key;
  return headers;
}

export async function testApiPollConnection(input: CadPollTestConnectionInput): Promise<CadPollTestConnectionResult> {
  const t0 = Date.now();
  try {
    const url = buildPollUrl(input.apiUrl, input.agencyCode);
    const res = await fetch(url, {
      method: "GET",
      headers: authHeaders(input),
      signal: AbortSignal.timeout(25_000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        sampleCount: 0,
        error: `Vendor API returned HTTP ${res.status}`,
        statusCode: res.status,
      };
    }
    const body = (await res.json()) as unknown;
    const list = Array.isArray(body) ? body : ((body as { incidents?: unknown[] }).incidents ?? []);
    return { ok: true, latencyMs, sampleCount: list.length };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      sampleCount: 0,
      error: e instanceof Error ? e.message : "connection_failed",
    };
  }
}
