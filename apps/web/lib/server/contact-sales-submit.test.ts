import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { submitContactSalesLeadUpstream } from "./contact-sales-submit";

const validBody = JSON.stringify({
  name: "Test User",
  email: "test@example.com",
  agencyCompany: "Test Agency",
  customerType: "county",
  interestedIn: ["dashboard_platform"],
  website: "",
});

describe("submitContactSalesLeadUpstream", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envSnapshot };
  });

  it("returns 503 when no upstream bases are configured", async () => {
    delete process.env.API_UPSTREAM_BASE;
    delete process.env.API_UPSTREAM_BASE_2;
    const res = await submitContactSalesLeadUpstream(validBody, "application/json");
    expect(res.status).toBe(503);
    const j = (await res.json()) as { error?: string };
    expect(j.error).toMatch(/API upstream is not configured/);
  });

  it("tries stack 3 before stack 2 and primary when all are set", async () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";

    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://stack3.example.com")) {
        return new Response(JSON.stringify({ ok: true, leadId: "lead-1" }), { status: 202 });
      }
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitContactSalesLeadUpstream(validBody, "application/json");
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://stack3.example.com/api/contact-sales");
  });

  it("tries stack 2 before primary when stack 3 is unset", async () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";

    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://stack2.example.com")) {
        return new Response(JSON.stringify({ ok: true, leadId: "lead-1" }), { status: 202 });
      }
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitContactSalesLeadUpstream(validBody, "application/json");
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://stack2.example.com/api/contact-sales");
  });

  it("falls back when stack 2 fetch fails but primary succeeds", async () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";

    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://stack2.example.com")) {
        throw new Error("fetch failed");
      }
      return new Response(JSON.stringify({ ok: true, leadId: "lead-3" }), { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitContactSalesLeadUpstream(validBody, "application/json");
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to primary when stack 2 returns 404", async () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";

    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://stack2.example.com")) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ ok: true, leadId: "lead-2" }), { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitContactSalesLeadUpstream(validBody, "application/json");
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://stack1.example.com/api/contact-sales");
  });
});
