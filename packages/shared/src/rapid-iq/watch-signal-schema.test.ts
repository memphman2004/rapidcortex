import { describe, expect, it } from "vitest";
import {
  computeWatchPriorityScore,
  isCanonicalWatchSignal,
  watchSignalSchema,
  watchSignalToPipelineIngest,
} from "rapid-cortex-shared";

const sample = {
  source: "chatgpt_watch" as const,
  watch: "psap_intelligence" as const,
  external_key: "FL|Ocala|RealTimeCrimeCenter|FY2027",
  primary_vertical: "rtcc" as const,
  verticals: ["rtcc", "psap"],
  agency: {
    name: "City of Ocala",
    department: "Police Department",
    city: "Ocala",
    state: "FL",
    country: "US",
  },
  signal: {
    type: "funded" as const,
    category: "RTCC",
    strength: "confirmed" as const,
    buying_stage: "planning" as const,
    event_date: "2026-05-04",
    title: "RTCC Data Integration & Intelligence Initiative",
  },
  opportunity: {
    solicitation_number: null,
    posted_date: null,
    due_date: null,
    status: "open",
    procurement_url: "https://example.gov/ocala-rtcc",
  },
  funding: {
    estimated_contract_value: null,
    project_budget: null,
    grant_amount: 1_300_000,
    annual_support: null,
    funding_source: "State grant request",
  },
  competitors: [],
  technologies: ["CAD"],
  pain_points: ["Decentralized data"],
  matched_capabilities: ["AI Incident Intelligence", "CAD Integration"],
  facts: ["Ocala identified decentralized public-safety data sources as an operational issue."],
  inferences: [
    "This creates a potential opportunity for NexCort iQ to operate as an intelligence aggregation layer.",
  ],
  contacts: [],
  qualification: {
    fit: "high" as const,
    strategy: "direct" as const,
    reason: "Centralized RTCC processing",
  },
  next_action: "Engage OPD before architecture is finalized.",
  lifecycle: { change_type: "new" as const, summary: "Planning identified" },
  evidence: [
    {
      url: "https://example.gov/ocala-rtcc",
      source_type: "city_agenda",
      source_quality: "authoritative" as const,
      document_title: "Agenda",
      page: null,
      meeting_date: "2026-05-04",
    },
  ],
};

describe("watchSignalSchema", () => {
  it("accepts a full WatchSignal", () => {
    const parsed = watchSignalSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it("rejects missing evidence", () => {
    const parsed = watchSignalSchema.safeParse({ ...sample, evidence: [] });
    expect(parsed.success).toBe(false);
  });

  it("detects canonical shape", () => {
    expect(isCanonicalWatchSignal(sample)).toBe(true);
    expect(isCanonicalWatchSignal({ source: "chatgpt_watch", watch: "x" })).toBe(false);
  });
});

describe("watchSignalToPipelineIngest", () => {
  it("maps funding fields without conflating grant and contract value", () => {
    const { body, enrichments } = watchSignalToPipelineIngest(watchSignalSchema.parse(sample));
    expect(body.opportunity.funding_amount).toBe(1_300_000);
    expect(body.opportunity.estimated_contract_value).toBeNull();
    expect(enrichments.facts[0]).toMatch(/decentralized/i);
    expect(enrichments.priorityLabel).toMatch(/URGENT|HIGH|MEDIUM|LOW/);
    expect(enrichments.priorityScore).toBeGreaterThan(40);
  });
});

describe("computeWatchPriorityScore", () => {
  it("scores high-fit confirmed procurement higher than weak planning", () => {
    const high = computeWatchPriorityScore({
      fit: "high",
      strength: "confirmed",
      buyingStage: "procurement_live",
      fundingIdentified: true,
      hasAuthoritativeEvidence: true,
      lifecycleChange: "new",
    });
    const low = computeWatchPriorityScore({
      fit: "low",
      strength: "weak",
      buyingStage: "awareness",
    });
    expect(high.priority_score).toBeGreaterThan(low.priority_score);
    expect(high.priority_label).toBe("URGENT");
  });
});
