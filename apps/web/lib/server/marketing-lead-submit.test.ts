import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  submitMarketingLeadUpstream,
  submitMarketingUnsubscribeUpstream,
  validateMarketingLeadBody,
  validateMarketingUnsubscribeBody,
} from "./marketing-lead-submit";
import { buildMarketingLeadRequestBody } from "rapid-cortex-shared";

describe("marketing-lead BFF submit", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envSnapshot };
  });

  it("validates the same payload the popup builds", () => {
    const built = buildMarketingLeadRequestBody(
      {
        firstName: "Casey",
        lastName: "Nguyen",
        email: "casey@city.gov",
        state: "CA",
      },
      {
        referrer: null,
        landingPage: "/",
        capturedAt: "2026-07-20T12:00:00.000Z",
      },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const validated = validateMarketingLeadBody(JSON.stringify(built.body));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(JSON.parse(validated.bodyText)).toMatchObject({
      firstName: "Casey",
      lastName: "Nguyen",
      email: "casey@city.gov",
      state: "CA",
      referrer: null,
      landingPage: "/",
      capturedAt: "2026-07-20T12:00:00.000Z",
    });
  });

  it("proxies lead POST to stack 3 first", async () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://stack3.example.com/api/marketing/lead");
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body).toMatchObject({
        firstName: "Casey",
        email: "casey@city.gov",
        landingPage: "/enter/",
      });
      return new Response(JSON.stringify({ success: true, leadId: "lead-xyz" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitMarketingLeadUpstream(
      JSON.stringify({
        firstName: "Casey",
        lastName: "Nguyen",
        email: "casey@city.gov",
        state: "CA",
        referrer: null,
        landingPage: "/enter/",
        capturedAt: "2026-07-20T12:00:00.000Z",
      }),
      "application/json",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, leadId: "lead-xyz" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("proxies unsubscribe POST to stack 3", async () => {
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    const token = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const validated = validateMarketingUnsubscribeBody(JSON.stringify({ token }));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://stack3.example.com/api/marketing/unsubscribe");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitMarketingUnsubscribeUpstream(validated.bodyText, "application/json");
    expect(res.status).toBe(200);
  });

  it("returns 503 when no upstream is configured", async () => {
    delete process.env.API_UPSTREAM_BASE;
    delete process.env.API_UPSTREAM_BASE_2;
    delete process.env.API_UPSTREAM_BASE_3;
    const res = await submitMarketingLeadUpstream("{}", "application/json");
    expect(res.status).toBe(503);
  });
});
