import { beforeEach, describe, expect, it, vi } from "vitest";

const { send, clearSalesUnsubscribe, isLocallyUnsubscribed, putSalesUnsubscribe } = vi.hoisted(() => ({
  send: vi.fn(),
  clearSalesUnsubscribe: vi.fn(async () => undefined),
  isLocallyUnsubscribed: vi.fn(async () => false),
  putSalesUnsubscribe: vi.fn(async () => undefined),
}));

vi.mock("./pipeline-ddb.js", () => ({
  pipelineDdb: { send },
}));

vi.mock("./sales-automation-db.js", () => ({
  clearSalesUnsubscribe,
  isLocallyUnsubscribed,
  putSalesUnsubscribe,
}));

import {
  emailListEntriesToCsv,
  isMonthlyEmailSubscribed,
  subscribeEmailList,
  unsubscribeEmailEverywhere,
} from "./email-list-db.js";

describe("email-list-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE = "test-pipeline";
    isLocallyUnsubscribed.mockResolvedValue(false);
    send.mockResolvedValue({});
  });

  it("refuses subscribe when locally unsubscribed without clear flag", async () => {
    isLocallyUnsubscribed.mockResolvedValue(true);
    const result = await subscribeEmailList({
      body: { email: "a@b.com", vertical: "PSAP", source: "manual" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsubscribed");
    expect(send).not.toHaveBeenCalled();
  });

  it("subscribes and clears unsub when allowed", async () => {
    isLocallyUnsubscribed.mockResolvedValue(true);
    const result = await subscribeEmailList({
      body: { email: "A@B.com", vertical: "PSAP", name: "Alex", source: "psap_prospect" },
      createdBy: "user-1",
      clearUnsubscribe: true,
    });
    expect(result.ok).toBe(true);
    expect(clearSalesUnsubscribe).toHaveBeenCalledWith("a@b.com");
    expect(send).toHaveBeenCalled();
    if (result.ok) {
      expect(result.entry.email).toBe("a@b.com");
      expect(result.entry.source).toBe("psap_prospect");
    }
  });

  it("unsubscribe writes UNSUB and deletes list rows", async () => {
    await unsubscribeEmailEverywhere("Person@Agency.gov");
    expect(putSalesUnsubscribe).toHaveBeenCalledWith("person@agency.gov");
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("isMonthlyEmailSubscribed is false when unsubscribed", async () => {
    isLocallyUnsubscribed.mockResolvedValue(true);
    await expect(isMonthlyEmailSubscribed("PSAP", "x@y.com")).resolves.toBe(false);
  });

  it("builds csv", () => {
    const csv = emailListEntriesToCsv([
      {
        email: "a@b.com",
        vertical: "PSAP",
        name: 'Smith, "JD"',
        source: "manual",
        createdAt: "2026-11-05T00:00:00.000Z",
      },
    ]);
    expect(csv).toContain("email,name,vertical");
    expect(csv).toContain("a@b.com");
  });
});
