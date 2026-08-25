import { describe, expect, it } from "vitest";
import type { RapidIqPipelineSignal } from "rapid-cortex-shared";
import { countUnworkedPipelineItems, pipelineOpportunityIdSet } from "./pipeline-api";

function stub(partial: Partial<RapidIqPipelineSignal> & Pick<RapidIqPipelineSignal, "status">): RapidIqPipelineSignal {
  return {
    signalId: partial.signalId ?? "s1",
    sourceId: partial.sourceId ?? "usa-spending",
    sourceUrl: partial.sourceUrl ?? "https://example.com",
    rawTitle: "Title",
    rawSnippet: "",
    contentHash: "abc",
    signalDate: "2026-08-01",
    ingestedAt: "2026-08-01T00:00:00.000Z",
    fitScore: 70,
    fitLabel: "medium",
    status: partial.status,
    opportunityId: partial.opportunityId,
  };
}

describe("countUnworkedPipelineItems", () => {
  it("counts Rapid IQ queued + reviewed, not collector inbox", () => {
    expect(
      countUnworkedPipelineItems([
        stub({ status: "new", sourceId: "openlegislative" }),
        stub({ status: "new", sourceId: "rapid-iq" }),
        stub({ status: "reviewed" }),
        stub({ status: "pushed" }),
        stub({ status: "dismissed" }),
      ]),
    ).toBe(2);
  });
});

describe("pipelineOpportunityIdSet", () => {
  it("includes opportunityId and Rapid IQ source hash, skips dismissed", () => {
    const ids = pipelineOpportunityIdSet([
      stub({ status: "new", opportunityId: "opp-1" }),
      stub({
        status: "new",
        sourceId: "rapid-iq",
        sourceUrl: "https://app.rapidcortex.us/rc-admin/rapid-iq#opp-2",
      }),
      stub({ status: "dismissed", opportunityId: "opp-3" }),
    ]);
    expect(ids.has("opp-1")).toBe(true);
    expect(ids.has("opp-2")).toBe(true);
    expect(ids.has("opp-3")).toBe(false);
  });
});
