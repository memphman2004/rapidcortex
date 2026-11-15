import { afterEach, describe, expect, it } from "vitest";
import { fetchMarketingSeoMetrics } from "./google-seo-client.js";

describe("fetchMarketingSeoMetrics", () => {
  afterEach(() => {
    delete process.env.MARKETING_GA4_MOCK;
  });

  it("returns mock payload when MARKETING_GA4_MOCK=1", async () => {
    process.env.MARKETING_GA4_MOCK = "1";
    const data = await fetchMarketingSeoMetrics({
      rangeDays: 30,
      crm: { demoRequests: 2, qualifiedLeads: 5, totalLeads: 10, conversionRate: 0.5 },
    });
    expect(data.measurementId).toBe("G-NGT17QK1LW");
    expect(data.search?.status).toBe("mock");
    expect(data.analytics?.status).toBe("mock");
    expect(data.crm?.qualifiedLeads).toBe(5);
    expect(data.authorization?.requiredGrants).toEqual([]);
  });
});
