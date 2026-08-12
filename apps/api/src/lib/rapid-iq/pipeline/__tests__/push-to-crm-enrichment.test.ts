import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RapidIqPipelineSignal } from "rapid-cortex-shared";

const putLead = vi.fn().mockResolvedValue(undefined);
const canSpend = vi.fn();
const spend = vi.fn();
const enrichViaApollo = vi.fn();
const enrichViaHunter = vi.fn();

vi.mock("../../../../repositories/salesLeadRepository.js", () => ({
  SalesLeadRepository: class {
    putLead = putLead;
  },
}));

vi.mock("../credit-guard.js", () => ({
  canSpend: (...args: unknown[]) => canSpend(...args),
  spend: (...args: unknown[]) => spend(...args),
  CREDIT_LIMITS: { apollo: 2500, hunter: 2000 },
}));

vi.mock("../enrich-apollo.js", () => ({
  enrichViaApollo: (...args: unknown[]) => enrichViaApollo(...args),
}));

vi.mock("../enrich-hunter.js", () => ({
  enrichViaHunter: (...args: unknown[]) => enrichViaHunter(...args),
  inferGovDomain: () => [],
}));

describe("createCrmLeadFromPipelineSignal credit exhaustion", () => {
  beforeEach(() => {
    putLead.mockClear();
    spend.mockClear();
    canSpend.mockReset();
    enrichViaApollo.mockReset();
    enrichViaHunter.mockReset();

    canSpend.mockResolvedValue({
      allowed: false,
      remaining: 0,
      used: 2500,
      limit: 2500,
      cycleStart: "2026-08-11",
      cycleEnd: "2026-09-10",
      reason: "Credit limit reached: 2500/2500 used this cycle (2026-08-11)",
    });
  });

  it("creates CRM lead with NLP hints when Apollo/Hunter credits are exhausted", async () => {
    const { createCrmLeadFromPipelineSignal } = await import(
      "../../../../handlers/rapid-iq/pipeline/push-to-crm.js"
    );

    const signal: RapidIqPipelineSignal = {
      signalId: "sig-jefferson-1",
      sourceId: "legistar-bulk",
      sourceUrl: "https://example.com/agenda",
      rawTitle: "Jefferson County CAD upgrade",
      rawSnippet: "Tyler Technologies ARPA funded new CAD for 911",
      contentHash: "abc123def456abc123def456abc123de",
      signalDate: "2026-07-15",
      ingestedAt: "2026-07-15T12:00:00.000Z",
      agencyName: "Jefferson County 911",
      jurisdiction: "Jefferson County",
      state: "ID",
      fitScore: 90,
      fitLabel: "high",
      status: "new",
      contactHints: [
        { name: "Jane Director", title: "911 Director", source: "extracted" },
      ],
    };

    const result = await createCrmLeadFromPipelineSignal(signal, {}, "tester@rapidcortex.us");

    expect(result.leadId).toBeTruthy();
    expect(result.enrichment.apolloCreditsUsed).toBe(0);
    expect(result.enrichment.hunterCreditsUsed).toBe(0);
    expect(result.enrichment.sources).toEqual(["nlp"]);
    expect(enrichViaApollo).not.toHaveBeenCalled();
    expect(enrichViaHunter).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(putLead).toHaveBeenCalledTimes(1);

    const leadArg = putLead.mock.calls[0]![0] as {
      name: string;
      message?: string;
    };
    expect(leadArg.name).toBe("Jane Director");
    expect(leadArg.message ?? "").toMatch(/credit limit|NLP-extracted|Enrichment/i);
  });
});
