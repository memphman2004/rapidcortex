import { describe, expect, it, vi } from "vitest";
import { postWatchIngest } from "./watch-ingest-client.js";
import type { WatchSignal } from "rapid-cortex-shared";

const signal = {
  source: "chatgpt_watch",
  watch: "psap_intelligence",
  external_key: "FL|Ocala|RTCC|FY2027",
  primary_vertical: "rtcc",
  verticals: ["rtcc", "psap"],
  agency: {
    name: "City of Ocala",
    department: "Police",
    city: "Ocala",
    state: "FL",
    country: "US",
  },
  signal: {
    type: "funded",
    category: "RTCC",
    strength: "confirmed",
    buying_stage: "planning",
    event_date: "2026-05-04",
    title: "RTCC Initiative",
  },
  opportunity: {
    solicitation_number: null,
    posted_date: null,
    due_date: null,
    status: "open",
    procurement_url: "https://example.gov/ocala",
  },
  funding: {
    estimated_contract_value: null,
    project_budget: null,
    grant_amount: 1000000,
    annual_support: null,
    funding_source: "grant",
  },
  competitors: [],
  technologies: ["CAD"],
  pain_points: ["data"],
  matched_capabilities: ["AI"],
  facts: ["fact"],
  inferences: ["inference"],
  contacts: [],
  qualification: { fit: "high", strategy: "direct", reason: "fit" },
  next_action: "Engage",
  lifecycle: { change_type: "new", summary: "new" },
  evidence: [
    {
      url: "https://example.gov/ocala",
      source_type: "agenda",
      source_quality: "authoritative",
      document_title: "Agenda",
      page: null,
      meeting_date: "2026-05-04",
    },
  ],
} as WatchSignal;

describe("postWatchIngest", () => {
  it("returns success on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          action: "created",
          signal_id: "sig-1",
          external_key: signal.external_key,
          lifecycle_event_created: true,
        }),
    });
    const result = await postWatchIngest(signal, {
      baseUrl: "https://api.example",
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.action).toBe("created");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = (fetchImpl.mock.calls[0]![1] as { body: string }).body;
    expect(JSON.parse(body).external_key).toBe(signal.external_key);
  });

  it("does not retry 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "no" }),
    });
    const result = await postWatchIngest(signal, {
      baseUrl: "https://api.example",
      apiKey: "bad",
      maxAttempts: 3,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("UNAUTHORIZED");
      expect(result.retryable).toBe(false);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry 400 validation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ success: false, error: "VALIDATION_ERROR" }),
    });
    const result = await postWatchIngest(signal, {
      baseUrl: "https://api.example",
      apiKey: "k",
      maxAttempts: 3,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("VALIDATION_ERROR");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 503 then succeeds, preserving external_key", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: "busy" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            action: "updated",
            signal_id: "sig-2",
            external_key: signal.external_key,
            lifecycle_event_created: false,
          }),
      });
    const result = await postWatchIngest(signal, {
      baseUrl: "https://api.example",
      apiKey: "k",
      maxAttempts: 3,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.mock.calls) {
      const body = JSON.parse((call[1] as { body: string }).body) as { external_key: string };
      expect(body.external_key).toBe(signal.external_key);
    }
  });
});
