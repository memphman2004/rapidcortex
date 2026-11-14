import type { CadWritebackBody } from "rapid-cortex-shared";
import type { CadWriteAdapter } from "./writeTypes.js";

function applyFieldMapping(
  payload: CadWritebackBody,
  mappingRaw: string | undefined,
): Record<string, unknown> {
  if (!mappingRaw?.trim()) {
    return { ...payload };
  }
  try {
    const mapping = JSON.parse(mappingRaw) as Record<string, string>;
    const body: Record<string, unknown> = {};
    for (const [outKey, payloadKey] of Object.entries(mapping)) {
      const v = (payload as Record<string, unknown>)[payloadKey];
      if (v !== undefined) body[outKey] = v;
    }
    return body;
  } catch {
    return { ...payload };
  }
}

export const genericWriteAdapter: CadWriteAdapter = {
  vendor: "generic_webhook",
  async healthCheck({ config }) {
    const writebackUrl = (config.writebackUrl ?? "").trim();
    if (!writebackUrl) {
      return { ok: false, detail: "writebackUrl not configured" };
    }
    const started = Date.now();
    try {
      const res = await fetch(writebackUrl, { method: "HEAD" });
      return {
        ok: res.ok || res.status === 405,
        detail: `HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      return {
        ok: false,
        detail: e instanceof Error ? e.message : "health_check_failed",
        latencyMs: Date.now() - started,
      };
    }
  },
  async read({ config, cadIncidentId }) {
    const readUrl = (config.readUrl ?? config.writebackUrl ?? "").trim();
    if (!readUrl) {
      return { ok: false, errorMessage: "readUrl not configured" };
    }
    const token = (config.webhookToken ?? "").trim();
    try {
      const url = new URL(readUrl);
      url.searchParams.set("cadIncidentId", cadIncidentId);
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: token ? { "X-RC-Token": token } : {},
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, errorMessage: `${res.status} ${res.statusText}` };
      }
      try {
        return { ok: true, incident: JSON.parse(text) as Record<string, unknown> };
      } catch {
        return { ok: true, incident: { raw: text.slice(0, 4000) } };
      }
    } catch (e) {
      return { ok: false, errorMessage: e instanceof Error ? e.message : "read_failed" };
    }
  },
  async submit({ payload, config, cadIncidentId }) {
    const writebackUrl = (config.writebackUrl ?? "").trim();
    if (!writebackUrl) {
      return { success: false, cadResponse: "", errorMessage: "writebackUrl not configured" };
    }
    const token = (config.webhookToken ?? "").trim();
    const body = applyFieldMapping(payload, config.writebackFieldMapping);
    body.cadIncidentId = cadIncidentId;
    try {
      const res = await fetch(writebackUrl, {
        method: "POST",
        headers: {
          "X-RC-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        return { success: false, cadResponse: text.slice(0, 4000), errorMessage: `${res.status} ${res.statusText}` };
      }
      return { success: true, cadResponse: text || JSON.stringify({ status: res.status }) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request_failed";
      return { success: false, cadResponse: "", errorMessage: msg };
    }
  },
};
