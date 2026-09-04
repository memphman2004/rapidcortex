import { describe, expect, it } from "vitest";
import type { RapidIqPipelineSignal } from "rapid-cortex-shared";
import {
  classifyPipelineFeedTab,
  countQueuedUnworked,
  feedTabForPipelineSignal,
  inboxPipelineSignals,
  isPipelineInboxSignal,
  isPipelineQueueSignal,
  queuedPipelineSignals,
} from "./pipeline-feed";

function stub(
  partial: Partial<RapidIqPipelineSignal> & Pick<RapidIqPipelineSignal, "status">,
): RapidIqPipelineSignal {
  return {
    signalId: partial.signalId ?? "s1",
    sourceId: partial.sourceId ?? "openlegislative",
    sourceUrl: partial.sourceUrl ?? "https://example.com",
    rawTitle: partial.rawTitle ?? "Title",
    rawSnippet: partial.rawSnippet ?? "",
    contentHash: "abc",
    signalDate: "2026-08-01",
    ingestedAt: "2026-08-01T00:00:00.000Z",
    fitScore: 70,
    fitLabel: "medium",
    status: partial.status,
    opportunityId: partial.opportunityId,
    agencyType: partial.agencyType,
    vendorNamed: partial.vendorNamed,
    summary: partial.summary,
    vertical: partial.vertical,
  };
}

describe("classifyPipelineFeedTab", () => {
  it("puts NG911 / legislature bills in 911", () => {
    expect(
      classifyPipelineFeedTab({
        sourceId: "openlegislative",
        rawTitle: "Iowa HSB 332 — next-generation 911 systems",
      }),
    ).toBe("911");
    expect(
      classifyPipelineFeedTab({
        sourceId: "state-911-board",
        rawTitle: "Board meeting",
      }),
    ).toBe("911");
  });

  it("classifies campus, venue, and transit keywords", () => {
    expect(classifyPipelineFeedTab({ rawTitle: "University campus safety RFP" })).toBe("campus");
    expect(classifyPipelineFeedTab({ rawTitle: "Stadium venue operations contract" })).toBe("venue");
    expect(classifyPipelineFeedTab({ rawTitle: "WMATA transit police CAD overlay" })).toBe("transit");
  });

  it("honors explicit vertical", () => {
    expect(classifyPipelineFeedTab({ vertical: "venue", rawTitle: "911 grant" })).toBe("venue");
  });

  it("routes 911.gov, grants, and competitor intel by source", () => {
    expect(classifyPipelineFeedTab({ sourceId: "911-gov", rawTitle: "Funding page" })).toBe("911");
    expect(classifyPipelineFeedTab({ sourceId: "grants-gov", rawTitle: "NOFO" })).toBe("911");
    expect(classifyPipelineFeedTab({ sourceId: "competitor-intel", rawTitle: "Vendor win" })).toBe(
      "competitor",
    );
    expect(
      classifyPipelineFeedTab({ sourceId: "university-procurement", rawTitle: "Purchasing portal" }),
    ).toBe("campus");
  });
});

describe("inbox vs pipeline queue", () => {
  it("treats collector new as inbox, Rapid IQ new as queued", () => {
    expect(isPipelineInboxSignal(stub({ status: "new", sourceId: "openlegislative" }))).toBe(true);
    expect(isPipelineQueueSignal(stub({ status: "new", sourceId: "openlegislative" }))).toBe(false);
    expect(isPipelineInboxSignal(stub({ status: "new", sourceId: "rapid-iq" }))).toBe(false);
    expect(isPipelineQueueSignal(stub({ status: "new", sourceId: "rapid-iq" }))).toBe(true);
    expect(isPipelineQueueSignal(stub({ status: "reviewed" }))).toBe(true);
  });

  it("splits a mixed list by tab", () => {
    const items = [
      stub({
        status: "new",
        sourceId: "openlegislative",
        rawTitle: "HSB 332 next-generation 911",
        signalId: "a",
      }),
      stub({
        status: "reviewed",
        sourceId: "openlegislative",
        rawTitle: "University campus CAD",
        signalId: "b",
      }),
      stub({
        status: "new",
        sourceId: "rapid-iq",
        vertical: "911",
        signalId: "c",
      }),
    ];
    expect(inboxPipelineSignals(items, "911").map((s) => s.signalId)).toEqual(["a"]);
    expect(queuedPipelineSignals(items, "911").map((s) => s.signalId)).toEqual(["c"]);
    expect(queuedPipelineSignals(items, "campus").map((s) => s.signalId)).toEqual(["b"]);
    expect(countQueuedUnworked(items, "911")).toBe(1);
  });

  it("routes known competitor vendors to Competitors", () => {
    expect(
      feedTabForPipelineSignal(
        stub({ status: "new", vendorNamed: "Motorola Solutions", rawTitle: "CAD refresh" }),
      ),
    ).toBe("competitor");
  });
});
