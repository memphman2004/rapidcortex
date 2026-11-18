import { describe, expect, it } from "vitest";
import { canVerifyAgencyIntelligence } from "./access.js";
import { emptyAgencyIntelligenceProfile } from "./profile.js";
import {
  SMALL_PRIMARY_PSAP_FILTER,
  buildProspectingRows,
  classifyProspect,
  toProspectingRow,
  type ProspectingSubject,
} from "./prospecting.js";
import { effectiveActiveRfp, salesZoneForState, vacancyPercentage } from "./rules.js";
import { validateEvidenceSubmission } from "./schemas.js";
import type { AgencyIntelligenceProfile } from "./types.js";
import { decideEvidence, submitEvidence } from "./workflow.js";

const NOW = "2026-11-17T15:00:00.000Z";
const RECENT = "2026-06-01";

function subject(
  profile: AgencyIntelligenceProfile | null,
  overrides: Partial<ProspectingSubject> = {},
): ProspectingSubject {
  return {
    psapId: "psap-1",
    agencyName: "Example County 911",
    state: "TX",
    county: "Example",
    city: "Example",
    outreachStatus: "UNCONTACTED",
    assignedToName: "Eric",
    profile,
    ...overrides,
  };
}

function approveField(
  profile: AgencyIntelligenceProfile | null,
  field: Parameters<typeof submitEvidence>[0]["body"]["field"],
  value: string | number | boolean,
  extra: Partial<Parameters<typeof submitEvidence>[0]["body"]> = {},
): AgencyIntelligenceProfile {
  const submitted = submitEvidence({
    profile,
    evidenceId: `ev-${field}-${String(value)}`,
    actor: "researcher",
    nowIso: NOW,
    body: {
      field,
      proposedValue: value,
      sourceType: "OFFICIAL_REPORT",
      sourcePublishedAt: RECENT,
      reportingPeriod: "FY2026",
      quotedPassage: "The communications center reports this figure in the annual report.",
      confidence: "HIGH",
      ...extra,
    },
  });
  if (!submitted.ok) throw new Error(submitted.message);
  const decided = decideEvidence({
    profile: submitted.profile,
    evidenceId: submitted.evidenceId,
    action: "approve",
    actor: "rc-admin",
    nowIso: NOW,
    decisionId: `dec-${field}`,
  });
  if (!decided.ok) throw new Error(decided.message);
  return decided.profile;
}

function verifiedPrimary(headcount: number | null, extras?: (profile: AgencyIntelligenceProfile) => AgencyIntelligenceProfile) {
  let profile = approveField(null, "psapClassification", "PRIMARY");
  if (headcount != null) {
    profile = approveField(profile, "reportedDispatcherHeadcount", headcount, {
      countingMethod: "DISTINCT_DISPATCH_PERSONNEL",
    });
  }
  return extras ? extras(profile) : profile;
}

describe("small primary PSAP filter", () => {
  it("includes a verified primary PSAP with seven dispatchers (Test D)", () => {
    const result = classifyProspect(subject(verifiedPrimary(7)), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(result.bucket).toBe("qualified");
    expect(result.headcount).toBe(7);
  });

  it("excludes a verified primary PSAP with eight dispatchers (Test E)", () => {
    const result = classifyProspect(subject(verifiedPrimary(8)), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(result.bucket).toBe("excluded");
    expect(result.exclusion).toBe("ABOVE_HEADCOUNT_MAXIMUM");
  });

  it("keeps missing headcount out of the qualified list and labels it unknown (Test F)", () => {
    const profile = verifiedPrimary(null);
    const row = toProspectingRow(subject(profile), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(row.bucket).toBe("research");
    expect(row.researchReasons).toContain("UNKNOWN_HEADCOUNT");
    expect(row.dispatcherHeadcount).toBe("Unknown");
    expect(row.dispatcherHeadcount).not.toBe("0");
  });

  it("does not exclude on vacancy when the vacancy filter is Any (Test G)", () => {
    for (const vacancies of [0, 2, null] as const) {
      const profile = verifiedPrimary(6, (current) =>
        vacancies == null
          ? current
          : approveField(current, "dispatcherVacancies", vacancies),
      );
      const result = classifyProspect(subject(profile), SMALL_PRIMARY_PSAP_FILTER, NOW);
      expect(result.bucket).toBe("qualified");
    }
  });

  it("keeps an agency with no modernization project (Test H)", () => {
    const result = classifyProspect(subject(verifiedPrimary(4)), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(result.bucket).toBe("qualified");
    const row = toProspectingRow(subject(verifiedPrimary(4)), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(row.modernizationStatus).toBe("UNKNOWN");
  });

  it("does not treat console positions as dispatcher headcount (Test I)", () => {
    const consoles = approveField(verifiedPrimary(null), "reportedDispatcherHeadcount", 7, {
      countingMethod: "CONSOLE_POSITIONS",
    });
    expect(classifyProspect(subject(consoles), SMALL_PRIMARY_PSAP_FILTER, NOW).bucket).toBe("research");
    const employees = approveField(verifiedPrimary(null), "reportedDispatcherHeadcount", 17, {
      countingMethod: "DISTINCT_DISPATCH_PERSONNEL",
    });
    expect(classifyProspect(subject(employees), SMALL_PRIMARY_PSAP_FILTER, NOW).exclusion).toBe(
      "ABOVE_HEADCOUNT_MAXIMUM",
    );
  });

  it("does not treat an unclassified record as a verified primary PSAP (Test J)", () => {
    const row = toProspectingRow(subject(null), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(row.bucket).toBe("research");
    expect(row.researchReasons).toContain("UNCONFIRMED_PRIMARY");
    expect(row.psapClassification).toBe("UNKNOWN");
  });

  it("keeps a consolidated center when it is a verified primary receiving point", () => {
    let profile = approveField(null, "psapClassification", "CONSOLIDATED_REGIONAL");
    profile = approveField(profile, "primaryReceivingPoint", true);
    profile = approveField(profile, "reportedDispatcherHeadcount", 5, {
      countingMethod: "DISTINCT_DISPATCH_PERSONNEL",
    });
    expect(classifyProspect(subject(profile), SMALL_PRIMARY_PSAP_FILTER, NOW).bucket).toBe("qualified");
  });

  it("does not qualify authorized positions under the default headcount method", () => {
    const profile = approveField(verifiedPrimary(null), "authorizedDispatcherPositions", 7);
    expect(classifyProspect(subject(profile), SMALL_PRIMARY_PSAP_FILTER, NOW).bucket).toBe("research");
    const rows = buildProspectingRows(
      [subject(profile)],
      SMALL_PRIMARY_PSAP_FILTER,
      { headcountBasis: "AUTHORIZED_POSITIONS" },
      NOW,
      "qualified",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dispatcherHeadcount).toBe("7");
  });
});

describe("verification workflow", () => {
  it("retains both claims and does not overwrite a verified count (Test L)", () => {
    const profile = verifiedPrimary(6);
    const submitted = submitEvidence({
      profile,
      evidenceId: "ev-conflict",
      actor: "researcher",
      nowIso: NOW,
      body: {
        field: "reportedDispatcherHeadcount",
        proposedValue: 8,
        countingMethod: "DISTINCT_DISPATCH_PERSONNEL",
        sourceType: "OFFICIAL_BUDGET",
        sourcePublishedAt: "2024-01-01",
        reportingPeriod: "FY2024",
        quotedPassage: "A prior budget lists eight dispatcher positions.",
        confidence: "MEDIUM",
      },
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const decided = decideEvidence({
      profile: submitted.profile,
      evidenceId: "ev-conflict",
      action: "approve",
      actor: "rc-admin",
      nowIso: NOW,
      decisionId: "dec-conflict",
    });
    expect(decided.ok && decided.outcome).toBe("conflict");
    if (!decided.ok) return;
    expect(decided.profile.staffing.reportedDispatcherHeadcount.value).toBe(6);
    expect(decided.profile.evidence.find((item) => item.evidenceId === "ev-conflict")?.verificationStatus).toBe(
      "CONFLICTING",
    );
  });

  it("records an incumbent CAD vendor and does not treat a bidder as the incumbent (Test M)", () => {
    let profile = approveField(null, "cadProvider", "Tyler Technologies", {
      cadProviderRole: "INCUMBENT",
      sourceType: "PROCUREMENT_RECORD",
    });
    const bidder = submitEvidence({
      profile,
      evidenceId: "ev-bidder",
      actor: "researcher",
      nowIso: NOW,
      body: {
        field: "cadProvider",
        proposedValue: "CentralSquare",
        cadProviderRole: "BIDDER",
        sourceType: "PROCUREMENT_RECORD",
        quotedPassage: "CentralSquare is listed among respondents to the RFP.",
        confidence: "HIGH",
      },
    });
    if (!bidder.ok) throw new Error(bidder.message);
    const decided = decideEvidence({
      profile: bidder.profile,
      evidenceId: "ev-bidder",
      action: "approve",
      actor: "rc-admin",
      nowIso: NOW,
      decisionId: "dec-bidder",
    });
    if (!decided.ok) throw new Error(decided.message);
    profile = decided.profile;
    expect(profile.technology.cadProvider.value).toBe("Tyler Technologies");
    expect(profile.technology.namedBidders).toContain("CentralSquare");
  });

  it("does not present an awarded procurement as an open RFP (Test O)", () => {
    const profile = approveField(emptyAgencyIntelligenceProfile("researcher", NOW), "modernizationStatus", "AWARDED");
    expect(effectiveActiveRfp(profile, NOW)).toBe(false);
  });

  it("publishes one approved fact and withholds a rejected fact (Test R)", () => {
    const submittedHeadcount = submitEvidence({
      profile: approveField(null, "psapClassification", "PRIMARY"),
      evidenceId: "ev-yes",
      actor: "researcher",
      nowIso: NOW,
      body: {
        field: "reportedDispatcherHeadcount",
        proposedValue: 6,
        countingMethod: "DISTINCT_DISPATCH_PERSONNEL",
        sourceType: "OFFICIAL_REPORT",
        reportingPeriod: "FY2026",
        sourcePublishedAt: RECENT,
        quotedPassage: "Six dispatch personnel are assigned to the center.",
        confidence: "HIGH",
      },
    });
    if (!submittedHeadcount.ok) throw new Error(submittedHeadcount.message);
    const submittedVacancies = submitEvidence({
      profile: submittedHeadcount.profile,
      evidenceId: "ev-no",
      actor: "researcher",
      nowIso: NOW,
      body: {
        field: "dispatcherVacancies",
        proposedValue: 3,
        sourceType: "JOB_POSTING",
        quotedPassage: "A posting seeks three additional telecommunicators.",
        confidence: "LOW",
      },
    });
    if (!submittedVacancies.ok) throw new Error(submittedVacancies.message);
    const approved = decideEvidence({
      profile: submittedVacancies.profile,
      evidenceId: "ev-yes",
      action: "approve",
      actor: "rc-admin",
      nowIso: NOW,
      decisionId: "dec-yes",
    });
    if (!approved.ok) throw new Error(approved.message);
    const rejected = decideEvidence({
      profile: approved.profile,
      evidenceId: "ev-no",
      action: "reject",
      actor: "rc-admin",
      nowIso: NOW,
      decisionId: "dec-no",
    });
    if (!rejected.ok) throw new Error(rejected.message);
    expect(rejected.profile.staffing.reportedDispatcherHeadcount.value).toBe(6);
    expect(rejected.profile.staffing.dispatcherVacancies.value).toBeNull();
    expect(rejected.profile.evidence.find((item) => item.evidenceId === "ev-no")?.decision).toBe("REJECTED");
    expect(rejected.profile.decisions).toHaveLength(3);
  });

  it("marks stale staffing without inventing a replacement value (Test S)", () => {
    const profile = approveField(verifiedPrimary(null), "reportedDispatcherHeadcount", 5, {
      countingMethod: "DISTINCT_DISPATCH_PERSONNEL",
      sourcePublishedAt: "2024-01-01",
      reportingPeriod: "FY2024",
    });
    const row = toProspectingRow(subject(profile), SMALL_PRIMARY_PSAP_FILTER, NOW);
    expect(row.bucket).toBe("research");
    expect(row.researchReasons).toContain("STALE_STAFFING");
    expect(row.headcountValue).toBe(5);
    expect(profile.staffing.reportedDispatcherHeadcount.value).toBe(5);
  });

  it("preserves FCC PSAP IDs as strings", () => {
    const rejected = validateEvidenceSubmission({
      field: "fccPsapId",
      proposedValue: 1234,
      sourceType: "FCC_REGISTRY",
      quotedPassage: "Registry row lists the identifier.",
      confidence: "LOW",
    });
    expect(rejected.ok).toBe(false);
    const accepted = validateEvidenceSubmission({
      field: "fccPsapId",
      proposedValue: "012345",
      sourceType: "FCC_REGISTRY",
      quotedPassage: "Registry row lists the identifier.",
      confidence: "LOW",
    });
    expect(accepted.ok && accepted.value).toBe("012345");
  });
});

describe("staffing definitions", () => {
  it("calculates vacancy percentage only when authorized and filled are both verified", () => {
    const partial = approveField(null, "authorizedDispatcherPositions", 10);
    expect(vacancyPercentage(partial.staffing)).toBeNull();
    const full = approveField(partial, "filledDispatcherPositions", 8);
    expect(vacancyPercentage(full.staffing)).toBe(20);
  });
});

describe("sales assignment", () => {
  it("maps a new agency to the existing zone without changing the assigned representative (Test Q)", () => {
    const zone = salesZoneForState("TX");
    expect(zone?.id).toBe("zone-1");
    const row = toProspectingRow(
      subject(verifiedPrimary(5), { assignedToName: "Eric" }),
      SMALL_PRIMARY_PSAP_FILTER,
      NOW,
    );
    expect(row.salesZoneId).toBe("zone-1");
    expect(row.assignedRepresentative).toBe("Eric");
  });
});

describe("access control", () => {
  it("denies sales representatives global verification (Test V)", () => {
    expect(canVerifyAgencyIntelligence("salescontractor")).toBe(false);
    expect(canVerifyAgencyIntelligence("rcitadmin")).toBe(false);
    expect(canVerifyAgencyIntelligence("rcadmin")).toBe(true);
    expect(canVerifyAgencyIntelligence("rcsuperadmin")).toBe(true);
  });
});
