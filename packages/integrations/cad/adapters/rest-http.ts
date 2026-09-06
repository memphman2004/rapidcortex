import type { CadAuthType } from "rapid-cortex-shared";
import type { ResolvedCadCredentials } from "../adapter/CadAdapter.js";

export class CadHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CadHttpError";
  }
}

function authHeaders(credentials: ResolvedCadCredentials): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  switch (credentials.authType as CadAuthType) {
    case "api_key":
      if (credentials.apiKey) headers["X-API-Key"] = credentials.apiKey;
      break;
    case "basic": {
      const pair = `${credentials.username ?? ""}:${credentials.password ?? ""}`;
      headers.Authorization = `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
      break;
    }
    case "oauth2":
      if (credentials.accessToken) headers.Authorization = `Bearer ${credentials.accessToken}`;
      break;
    case "mtls":
      break;
    default:
      break;
  }
  return headers;
}

export async function cadHttpRequest(params: {
  baseUrl: string;
  path: string;
  method?: string;
  credentials: ResolvedCadCredentials;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  timeoutMs: number;
}): Promise<{ status: number; json: unknown; text: string }> {
  const root = params.baseUrl.replace(/\/$/, "");
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const url = new URL(`${root}${path}`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const res = await fetch(url, {
      method: params.method ?? "GET",
      headers: {
        ...authHeaders(params.credentials),
        ...(params.body ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      throw new CadHttpError(`CAD HTTP ${res.status}`, res.status);
    }
    return { status: res.status, json, text };
  } catch (err) {
    if (err instanceof CadHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new CadHttpError("CAD request timed out");
    }
    throw new CadHttpError(err instanceof Error ? err.message : "CAD request failed");
  } finally {
    clearTimeout(timer);
  }
}

/** Minimal SOAP/XML tag harvest for older Tyler/Hexagon payloads. */
export function xmlToRecord(xml: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const re = /<([A-Za-z0-9_:-]+)>([^<]*)<\/\1>/g;
  let match: RegExpExecArray | null = re.exec(xml);
  while (match) {
    const key = (match[1] ?? "").replace(/^.*:/, "");
    out[key] = match[2];
    match = re.exec(xml);
  }
  return out;
}

export function extractIncidentRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    for (const key of ["incidents", "items", "data", "Events", "calls", "results"]) {
      const nested = rec[key];
      if (Array.isArray(nested)) {
        return nested.filter(
          (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
        );
      }
    }
    return [rec];
  }
  return [];
}
