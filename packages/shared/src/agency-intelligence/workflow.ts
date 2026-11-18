import { emptyAgencyIntelligenceProfile } from "./profile.js";
import {
  evidenceNeedsPassage,
  validateEvidenceSubmission,
  type SubmitEvidenceBody,
} from "./schemas.js";
import type {
  AgencyIntelligenceProfile,
  EvidenceClaim,
  IntelligenceField,
  AgencyIntelligenceVerificationStatus,
} from "./types.js";

const MAX_EVIDENCE = 50;
const MAX_DECISIONS = 100;
const MAX_HISTORY = 100;

export type WorkflowFailure = {
  ok: false;
  code: string;
  message: string;
};

export type SubmitResult =
  | { ok: true; profile: AgencyIntelligenceProfile; outcome: "submitted" | "duplicate"; evidenceId: string }
  | WorkflowFailure;

export type DecisionOutcome = "approved" | "rejected" | "conflict" | "already_decided";

export type DecisionResult =
  | { ok: true; profile: AgencyIntelligenceProfile; outcome: DecisionOutcome; evidenceId: string }
  | WorkflowFailure;

function statusForSource(source: EvidenceClaim["sourceType"]): AgencyIntelligenceVerificationStatus {
  switch (source) {
    case "AGENCY_CONFIRMATION":
      return "AGENCY_CONFIRMED";
    case "OFFICIAL_BUDGET":
    case "OFFICIAL_REPORT":
    case "STATE_DIRECTORY":
    case "PROCUREMENT_RECORD":
      return "OFFICIAL_SOURCE_VERIFIED";
    default:
      return "THIRD_PARTY_SOURCED";
  }
}

function valuesEqual(
  left: string | number | boolean | null,
  right: string | number | boolean | null,
): boolean {
  if (typeof left === "string" && typeof right === "string") return left.trim() === right.trim();
  return Object.is(left, right);
}

type Published = {
  value: string | number | boolean | null;
  verificationStatus: AgencyIntelligenceVerificationStatus;
};

function publishedFact(profile: AgencyIntelligenceProfile, field: IntelligenceField): Published {
  switch (field) {
    case "psapClassification":
      return profile.psapClassification;
    case "primaryReceivingPoint":
      return profile.primaryReceivingPoint;
    case "fccPsapId":
      return profile.fccPsapId;
    case "reportedDispatcherHeadcount":
      return profile.staffing.reportedDispatcherHeadcount;
    case "authorizedDispatcherPositions":
      return profile.staffing.authorizedDispatcherPositions;
    case "filledDispatcherPositions":
      return profile.staffing.filledDispatcherPositions;
    case "fullTimeDispatcherCount":
      return profile.staffing.fullTimeDispatcherCount;
    case "partTimeDispatcherCount":
      return profile.staffing.partTimeDispatcherCount;
    case "reserveOrPerDiemDispatcherCount":
      return profile.staffing.reserveOrPerDiemDispatcherCount;
    case "dispatchCapableSupervisors":
      return profile.staffing.dispatchCapableSupervisors;
    case "dispatcherVacancies":
      return profile.staffing.dispatcherVacancies;
    case "dispatcherFte":
      return profile.staffing.dispatcherFte;
    case "annual911Calls":
      return profile.callVolume.annual911Calls;
    case "annualAdministrativeCalls":
      return profile.callVolume.annualAdministrativeCalls;
    case "annualNonEmergencyCalls":
      return profile.callVolume.annualNonEmergencyCalls;
    case "cadProvider":
      return profile.technology.cadProvider;
    case "modernizationStatus":
      return profile.modernization.status;
    case "activeRfp":
      return profile.modernization.activeRfp;
    case "rfpDeadline":
      return { value: profile.modernization.rfpDeadline, verificationStatus: "UNKNOWN" };
    default:
      return { value: null, verificationStatus: "UNKNOWN" };
  }
}

function withPublished(
  profile: AgencyIntelligenceProfile,
  evidence: EvidenceClaim,
  verificationStatus: AgencyIntelligenceVerificationStatus,
): AgencyIntelligenceProfile {
  const next: AgencyIntelligenceProfile = structuredClone(profile);
  const fact = {
    value: evidence.proposedValue as never,
    verificationStatus,
    reportingPeriod: evidence.reportingPeriod,
    reportDate: evidence.sourcePublishedAt,
    evidenceId: evidence.evidenceId,
    sourceType: evidence.sourceType,
  };
  switch (evidence.field) {
    case "psapClassification":
      next.psapClassification = fact;
      break;
    case "primaryReceivingPoint":
      next.primaryReceivingPoint = fact;
      break;
    case "fccPsapId":
      next.fccPsapId = fact;
      break;
    case "reportedDispatcherHeadcount":
      next.staffing.reportedDispatcherHeadcount = {
        ...fact,
        value: evidence.proposedValue as number,
        countingMethod: evidence.countingMethod,
      };
      break;
    case "authorizedDispatcherPositions":
      next.staffing.authorizedDispatcherPositions = fact;
      break;
    case "filledDispatcherPositions":
      next.staffing.filledDispatcherPositions = fact;
      break;
    case "fullTimeDispatcherCount":
      next.staffing.fullTimeDispatcherCount = fact;
      break;
    case "partTimeDispatcherCount":
      next.staffing.partTimeDispatcherCount = fact;
      break;
    case "reserveOrPerDiemDispatcherCount":
      next.staffing.reserveOrPerDiemDispatcherCount = fact;
      break;
    case "dispatchCapableSupervisors":
      next.staffing.dispatchCapableSupervisors = fact;
      break;
    case "dispatcherVacancies":
      next.staffing.dispatcherVacancies = fact;
      break;
    case "dispatcherFte":
      next.staffing.dispatcherFte = fact;
      break;
    case "annual911Calls":
      next.callVolume.annual911Calls = fact;
      break;
    case "annualAdministrativeCalls":
      next.callVolume.annualAdministrativeCalls = fact;
      break;
    case "annualNonEmergencyCalls":
      next.callVolume.annualNonEmergencyCalls = fact;
      break;
    case "cadProvider":
      if (evidence.cadProviderRole === "BIDDER") {
        const name = String(evidence.proposedValue);
        if (!next.technology.namedBidders.includes(name)) next.technology.namedBidders.push(name);
      } else {
        next.technology.cadProvider = { ...fact, value: String(evidence.proposedValue) };
      }
      break;
    case "modernizationStatus":
      next.modernization.status = fact;
      break;
    case "activeRfp":
      next.modernization.activeRfp = fact;
      break;
    case "rfpDeadline":
      next.modernization.rfpDeadline = String(evidence.proposedValue);
      break;
    default:
      break;
  }
  return next;
}

export function submitEvidence(args: {
  profile: AgencyIntelligenceProfile | null;
  body: SubmitEvidenceBody;
  evidenceId: string;
  actor: string;
  nowIso: string;
}): SubmitResult {
  const validated = validateEvidenceSubmission(args.body);
  if (!validated.ok) return { ok: false, code: "INVALID_VALUE", message: validated.message };

  if (evidenceNeedsPassage(args.body.sourceType)) {
    const passage = args.body.quotedPassage?.trim() ?? "";
    if (passage.length < 12) {
      return {
        ok: false,
        code: "PASSAGE_REQUIRED",
        message: "Quote the source passage or locator. Do not submit a fact without evidence.",
      };
    }
  }
  if (args.body.sourceType === "AGENCY_CONFIRMATION" && !args.body.contactRole?.trim()) {
    return {
      ok: false,
      code: "CONTACT_ROLE_REQUIRED",
      message: "Agency confirmation needs the contact role of the person who verified the fact.",
    };
  }

  const profile = args.profile ?? emptyAgencyIntelligenceProfile(args.actor, args.nowIso);
  if (profile.evidence.length >= MAX_EVIDENCE) {
    return {
      ok: false,
      code: "EVIDENCE_LIMIT",
      message: "This agency has reached the evidence history limit for Phase 1.",
    };
  }

  const duplicate = profile.evidence.find(
    (claim) =>
      claim.decision === "PENDING" &&
      claim.field === args.body.field &&
      valuesEqual(claim.proposedValue, validated.value) &&
      claim.sourceType === args.body.sourceType &&
      claim.reportingPeriod === (args.body.reportingPeriod ?? null),
  );
  if (duplicate) {
    return { ok: true, profile, outcome: "duplicate", evidenceId: duplicate.evidenceId };
  }

  const claim: EvidenceClaim = {
    evidenceId: args.evidenceId,
    field: args.body.field,
    proposedValue: validated.value,
    countingMethod: args.body.countingMethod ?? null,
    cadProviderRole: args.body.cadProviderRole ?? null,
    sourceType: args.body.sourceType,
    sourceUrl: args.body.sourceUrl ?? null,
    sourcePublishedAt: args.body.sourcePublishedAt ?? null,
    reportingPeriod: args.body.reportingPeriod ?? null,
    quotedPassage: args.body.quotedPassage?.trim() ?? null,
    contactRole: args.body.contactRole?.trim() ?? null,
    confidence: args.body.confidence,
    verificationStatus: "PENDING_REVIEW",
    extractedAt: args.nowIso,
    submittedBy: args.actor,
    reviewedBy: null,
    reviewedAt: null,
    decision: "PENDING",
  };

  return {
    ok: true,
    outcome: "submitted",
    evidenceId: claim.evidenceId,
    profile: {
      ...profile,
      evidence: [claim, ...profile.evidence],
      updatedAt: args.nowIso,
      updatedBy: args.actor,
    },
  };
}

function protectsExisting(
  current: Published,
  incoming: EvidenceClaim,
): boolean {
  if (current.value == null) return false;
  if (valuesEqual(current.value, incoming.proposedValue)) return false;
  if (current.verificationStatus === "AGENCY_CONFIRMED") return true;
  if (current.verificationStatus === "OFFICIAL_SOURCE_VERIFIED") return true;
  if (current.verificationStatus === "CONFLICTING") return true;
  return false;
}

export function decideEvidence(args: {
  profile: AgencyIntelligenceProfile;
  evidenceId: string;
  action: "approve" | "reject" | "approve_over_conflict";
  actor: string;
  nowIso: string;
  decisionId: string;
  note?: string | null;
}): DecisionResult {
  const claim = args.profile.evidence.find((item) => item.evidenceId === args.evidenceId);
  if (!claim) return { ok: false, code: "NOT_FOUND", message: "Evidence record was not found." };
  if (claim.decision === "APPROVED" || claim.decision === "REJECTED") {
    return { ok: true, profile: args.profile, outcome: "already_decided", evidenceId: claim.evidenceId };
  }

  const mark = (nextClaim: EvidenceClaim, profile: AgencyIntelligenceProfile): AgencyIntelligenceProfile => ({
    ...profile,
    evidence: profile.evidence.map((item) => (item.evidenceId === nextClaim.evidenceId ? nextClaim : item)),
    updatedAt: args.nowIso,
    updatedBy: args.actor,
  });

  if (args.action === "reject") {
    const rejected: EvidenceClaim = {
      ...claim,
      decision: "REJECTED",
      reviewedBy: args.actor,
      reviewedAt: args.nowIso,
    };
    const profile = mark(rejected, args.profile);
    return {
      ok: true,
      outcome: "rejected",
      evidenceId: claim.evidenceId,
      profile: appendDecision(profile, {
        decisionId: args.decisionId,
        evidenceId: claim.evidenceId,
        action: "reject",
        decidedBy: args.actor,
        decidedAt: args.nowIso,
        note: args.note ?? null,
        previousValue: publishedFact(args.profile, claim.field).value,
      }),
    };
  }

  const current = publishedFact(args.profile, claim.field);
  const bidderOnly = claim.field === "cadProvider" && claim.cadProviderRole === "BIDDER";
  if (!bidderOnly && protectsExisting(current, claim) && args.action !== "approve_over_conflict") {
    const conflicting: EvidenceClaim = {
      ...claim,
      verificationStatus: "CONFLICTING",
      reviewedBy: args.actor,
      reviewedAt: args.nowIso,
    };
    return {
      ok: true,
      outcome: "conflict",
      evidenceId: claim.evidenceId,
      profile: mark(conflicting, args.profile),
    };
  }

  const verification = statusForSource(claim.sourceType);
  let published = withPublished(args.profile, claim, verification);
  if (
    !bidderOnly &&
    current.value != null &&
    !valuesEqual(current.value, claim.proposedValue)
  ) {
    published = {
      ...published,
      valueHistory: [
        {
          field: claim.field,
          previousValue: current.value,
          previousVerification: current.verificationStatus,
          replacedAt: args.nowIso,
          replacedByEvidenceId: claim.evidenceId,
          replacedBy: args.actor,
        },
        ...published.valueHistory,
      ].slice(0, MAX_HISTORY),
    };
  }

  const approved: EvidenceClaim = {
    ...claim,
    decision: "APPROVED",
    verificationStatus: verification,
    reviewedBy: args.actor,
    reviewedAt: args.nowIso,
  };
  published = mark(approved, published);
  published = appendDecision(published, {
    decisionId: args.decisionId,
    evidenceId: claim.evidenceId,
    action: args.action === "approve_over_conflict" ? "approve_over_conflict" : "approve",
    decidedBy: args.actor,
    decidedAt: args.nowIso,
    note: args.note ?? null,
    previousValue: current.value,
  });
  return { ok: true, outcome: "approved", evidenceId: claim.evidenceId, profile: published };
}

function appendDecision(
  profile: AgencyIntelligenceProfile,
  decision: AgencyIntelligenceProfile["decisions"][number],
): AgencyIntelligenceProfile {
  return {
    ...profile,
    decisions: [decision, ...profile.decisions].slice(0, MAX_DECISIONS),
  };
}
