import { describe, expect, it } from "vitest";
import { matchWorkflow, normalizeUtterance, type MatchableWorkflow } from "./diversionService.js";

function workflow(overrides: Partial<MatchableWorkflow> & { workflowId: string }): MatchableWorkflow {
  return {
    workflowId: overrides.workflowId,
    name: overrides.name ?? overrides.workflowId,
    intents: overrides.intents ?? [],
    enabled: overrides.enabled,
    sortOrder: overrides.sortOrder,
  };
}

const WORKFLOWS: MatchableWorkflow[] = [
  workflow({
    workflowId: "wf-noise",
    name: "Noise Complaint",
    intents: ["noise complaint", "loud music", "neighbors are too loud", "party is too loud"],
    sortOrder: 0,
  }),
  workflow({
    workflowId: "wf-parking",
    name: "Parking Complaint",
    intents: ["parking complaint", "car parked illegally", "blocked driveway"],
    sortOrder: 1,
  }),
  workflow({
    workflowId: "wf-theft",
    name: "Minor Theft Report",
    intents: ["someone stole my package", "package theft", "porch pirate", "bike was stolen"],
    sortOrder: 2,
  }),
  workflow({
    workflowId: "wf-disabled",
    name: "Disabled Workflow",
    intents: ["noise complaint"],
    enabled: false,
    sortOrder: -1,
  }),
];

describe("normalizeUtterance", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeUtterance("  My NEIGHBOR'S Party is TOO Loud!!  ")).toBe(
      "my neighbor s party is too loud",
    );
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeUtterance("...")).toBe("");
  });
});

describe("matchWorkflow", () => {
  it("matches on exact substring containment", () => {
    const result = matchWorkflow("I'd like to report a noise complaint", WORKFLOWS);
    expect(result?.workflow.workflowId).toBe("wf-noise");
    expect(result?.score).toBe(1);
  });

  it("matches via token overlap when there is no exact substring hit", () => {
    const result = matchWorkflow("my neighbors are way too loud tonight", WORKFLOWS);
    expect(result?.workflow.workflowId).toBe("wf-noise");
  });

  it("picks the workflow with the strongest signal among multiple candidates", () => {
    const result = matchWorkflow("someone stole my package off the porch", WORKFLOWS);
    expect(result?.workflow.workflowId).toBe("wf-theft");
  });

  it("returns null when nothing clears the overlap threshold", () => {
    const result = matchWorkflow("I need help with my taxes", WORKFLOWS);
    expect(result).toBeNull();
  });

  it("returns null for empty or whitespace-only utterances", () => {
    expect(matchWorkflow("   ", WORKFLOWS)).toBeNull();
    expect(matchWorkflow("", WORKFLOWS)).toBeNull();
  });

  it("ignores disabled workflows even with a strong match", () => {
    const onlyDisabled = WORKFLOWS.filter((w) => w.workflowId === "wf-disabled");
    expect(matchWorkflow("noise complaint", onlyDisabled)).toBeNull();
  });

  it("respects sortOrder as a tiebreaker preference when scores are equal", () => {
    const tied: MatchableWorkflow[] = [
      workflow({ workflowId: "second", intents: ["report an issue"], sortOrder: 5 }),
      workflow({ workflowId: "first", intents: ["report an issue"], sortOrder: 0 }),
    ];
    const result = matchWorkflow("report an issue please", tied);
    expect(result?.workflow.workflowId).toBe("first");
  });
});
