type FetchLike = typeof fetch;

const LIST_KEYS = ["incidents", "Incidents", "events", "Events", "data", "results", "value", "Items"];

export function unwrapCadIncidentList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  for (const key of LIST_KEYS) {
    const v = o[key];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const nested = unwrapCadIncidentList(v);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

export function asUnitList(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const units = raw.map((u) => (typeof u === "string" ? u : String((u as Record<string, unknown>)?.unitId ?? (u as Record<string, unknown>)?.UnitId ?? ""))).filter(Boolean);
    return units.length ? units : undefined;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
}

export async function cadHttpGetJson(options: {
  baseUrl: string;
  apiKey: string;
  path: string;
  timeoutMs: number;
  fetchFn: FetchLike;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchFn(`${options.baseUrl.replace(/\/$/, "")}${options.path}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": options.apiKey,
        authorization: `Bearer ${options.apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`CAD request failed: ${response.status} ${response.statusText}`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Malformed CAD response: expected valid JSON.");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`CAD request timeout after ${options.timeoutMs}ms.`);
    }
    if (error instanceof Error) {
      throw new Error(`CAD request error: ${error.message}`);
    }
    throw new Error("CAD request error.");
  } finally {
    clearTimeout(timeout);
  }
}
