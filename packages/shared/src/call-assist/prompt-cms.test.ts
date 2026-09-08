import { describe, expect, it } from "vitest";
import {
  applyPromptUpsert,
  applyProposalDecision,
  diffPromptText,
  draftPromptFromQa,
  promptIdFromQaFinding,
  promptPackVersionLabel,
  rollbackPrompt,
} from "./prompt-cms.js";

describe("Call Assist prompt CMS", () => {
  it("versions upserts and can roll back", () => {
    const v1 = applyPromptUpsert(null, {
      agencyId: "a1",
      promptId: "opening",
      body: "hello",
      actorId: "u1",
      at: "t1",
    });
    const v2 = applyPromptUpsert(v1, {
      agencyId: "a1",
      promptId: "opening",
      body: "hello world",
      actorId: "u2",
      at: "t2",
    });
    expect(v2.version).toBe(2);
    expect(v2.previous[0]?.body).toBe("hello");
    const rolled = rollbackPrompt(v2, 1, "u3", "t3");
    expect(rolled?.body).toBe("hello");
    expect(rolled?.version).toBe(3);
    expect(promptPackVersionLabel([v2])).toBe("cms-v2");
  });

  it("does not publish QA findings until a supervisor approves", () => {
    const draft = draftPromptFromQa({
      currentBody: "Stay on the line.",
      findingSummary: "Missed disclosure.",
      notes: "Add recording notice.",
    });
    expect(draft).toContain("[QA coaching — not live until an agency administrator approves]");
    expect(promptIdFromQaFinding({ failedChecklistIds: ["disclosure"] })).toBe("opening");
    const approved = applyProposalDecision(
      {
        proposalId: "p1",
        agencyId: "a1",
        promptId: "opening",
        source: "qa_finding",
        findingSummary: "x",
        currentBody: "old",
        proposedBody: "new",
        status: "pending_approval",
        submittedBy: "u1",
        submittedAt: "t1",
      },
      "approve",
      "u2",
      "t2",
    );
    expect(approved?.status).toBe("approved");
    expect(applyProposalDecision(approved!, "approve", "u3", "t3")).toBeNull();
  });

  it("diffs previous vs new lines", () => {
    const diff = diffPromptText("one\ntwo", "one\nthree");
    expect(diff.some((d) => d.type === "del" && d.text === "two")).toBe(true);
    expect(diff.some((d) => d.type === "add" && d.text === "three")).toBe(true);
    expect(diff.some((d) => d.type === "same" && d.text === "one")).toBe(true);
  });
});
