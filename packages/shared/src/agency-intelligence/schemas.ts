import { z } from "zod";
import {
  CAD_PROVIDER_ROLES,
  EVIDENCE_CONFIDENCE,
  EVIDENCE_SOURCE_TYPES,
  INTELLIGENCE_FIELDS,
  STAFFING_COUNT_METHODS,
} from "./types.js";

const numericFact = z.number().finite();

export const submitEvidenceBodySchema = z
  .object({
    field: z.enum(INTELLIGENCE_FIELDS),
    proposedValue: z.union([z.string(), z.number(), z.boolean()]),
    countingMethod: z.enum(STAFFING_COUNT_METHODS).nullable().optional(),
    cadProviderRole: z.enum(CAD_PROVIDER_ROLES).nullable().optional(),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
    sourcePublishedAt: z.string().trim().max(40).nullable().optional(),
    reportingPeriod: z.string().trim().min(2).max(40).nullable().optional(),
    quotedPassage: z.string().trim().max(2000).nullable().optional(),
    contactRole: z.string().trim().min(2).max(120).nullable().optional(),
    confidence: z.enum(EVIDENCE_CONFIDENCE).default("MEDIUM"),
  })
  .strict();

export type SubmitEvidenceBody = z.infer<typeof submitEvidenceBodySchema>;

export const verificationDecisionBodySchema = z
  .object({
    evidenceId: z.string().trim().min(8).max(80),
    action: z.enum(["approve", "reject", "approve_over_conflict"]),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export type VerificationDecisionBody = z.infer<typeof verificationDecisionBodySchema>;

export const prospectingQuerySchema = z.object({
  view: z.enum(["qualified", "research", "excluded"]).default("qualified"),
  state: z.string().trim().length(2).optional(),
  county: z.string().trim().max(80).optional(),
  salesZone: z.enum(["zone-1", "zone-2", "zone-3", "zone-4", "zone-5", "zone-6"]).optional(),
  cadVendor: z.string().trim().max(120).optional(),
  headcountBasis: z.enum(["DISTINCT_DISPATCH_PERSONNEL", "AUTHORIZED_POSITIONS", "FTE"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const INTEGER_FIELDS = new Set([
  "reportedDispatcherHeadcount",
  "authorizedDispatcherPositions",
  "filledDispatcherPositions",
  "fullTimeDispatcherCount",
  "partTimeDispatcherCount",
  "reserveOrPerDiemDispatcherCount",
  "dispatchCapableSupervisors",
  "dispatcherVacancies",
  "annual911Calls",
  "annualAdministrativeCalls",
  "annualNonEmergencyCalls",
]);

export type EvidenceValidation =
  | { ok: true; value: string | number | boolean }
  | { ok: false; message: string };

/**
 * Deterministic checks for submitted facts. Language-model extraction is not
 * part of Phase 1; numeric fields must already be numbers.
 */
export function validateEvidenceSubmission(input: SubmitEvidenceBody): EvidenceValidation {
  const { field, proposedValue } = input;

  if (field === "fccPsapId") {
    if (typeof proposedValue !== "string") {
      return {
        ok: false,
        message: "FCC PSAP ID must be a string so leading zeros are preserved.",
      };
    }
    const id = proposedValue.trim();
    if (!/^[0-9A-Za-z-]{2,32}$/.test(id)) {
      return { ok: false, message: "FCC PSAP ID format is not valid." };
    }
    return { ok: true, value: id };
  }

  if (field === "psapClassification") {
    if (
      proposedValue !== "PRIMARY" &&
      proposedValue !== "SECONDARY" &&
      proposedValue !== "CONSOLIDATED_REGIONAL" &&
      proposedValue !== "UNKNOWN" &&
      proposedValue !== "CLOSED_MERGED_INACTIVE"
    ) {
      return { ok: false, message: "PSAP classification is not a recognized value." };
    }
    return { ok: true, value: proposedValue };
  }

  if (field === "modernizationStatus") {
    const allowed = [
      "UNKNOWN",
      "NONE_REPORTED",
      "DISCUSSED",
      "PLANNED",
      "FUNDED",
      "SOLICITED",
      "AWARDED",
      "CANCELED",
    ];
    if (typeof proposedValue !== "string" || !allowed.includes(proposedValue)) {
      return { ok: false, message: "Modernization status is not a recognized value." };
    }
    return { ok: true, value: proposedValue };
  }

  if (field === "primaryReceivingPoint" || field === "activeRfp") {
    if (typeof proposedValue !== "boolean") {
      return { ok: false, message: `${field} must be true or false.` };
    }
    return { ok: true, value: proposedValue };
  }

  if (field === "rfpDeadline") {
    if (typeof proposedValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(proposedValue)) {
      return { ok: false, message: "RFP deadline must be an ISO date (YYYY-MM-DD)." };
    }
    return { ok: true, value: proposedValue };
  }

  if (field === "cadProvider") {
    if (typeof proposedValue !== "string" || proposedValue.trim().length < 2) {
      return { ok: false, message: "CAD provider needs a vendor name." };
    }
    if (!input.cadProviderRole || input.cadProviderRole === "UNKNOWN") {
      return {
        ok: false,
        message: "Say whether the vendor is the incumbent or only a bidder.",
      };
    }
    return { ok: true, value: proposedValue.trim() };
  }

  if (field === "reportedDispatcherHeadcount" && !input.countingMethod) {
    return {
      ok: false,
      message: "Dispatcher headcount requires a counting method. Console positions and on-duty shift counts are not headcount.",
    };
  }

  if (INTEGER_FIELDS.has(field)) {
    if (typeof proposedValue !== "number" || !Number.isInteger(proposedValue)) {
      return { ok: false, message: `${field} must be a whole number. Unknown stays blank; do not send zero for missing data.` };
    }
    if (proposedValue < 0 || proposedValue > 100_000_000) {
      return { ok: false, message: `${field} is out of range.` };
    }
    return { ok: true, value: proposedValue };
  }

  if (field === "dispatcherFte") {
    if (typeof proposedValue !== "number" || !Number.isFinite(proposedValue)) {
      return { ok: false, message: "Dispatcher FTE must be a number." };
    }
    if (proposedValue < 0 || proposedValue > 10_000) {
      return { ok: false, message: "Dispatcher FTE is out of range." };
    }
    return { ok: true, value: proposedValue };
  }

  if (typeof proposedValue === "number") {
    return numericFact.safeParse(proposedValue).success
      ? { ok: true, value: proposedValue }
      : { ok: false, message: "Numeric value is not valid." };
  }

  return { ok: false, message: "This field cannot be saved from the submitted value." };
}

export function evidenceNeedsPassage(sourceType: SubmitEvidenceBody["sourceType"]): boolean {
  return sourceType !== "AGENCY_CONFIRMATION";
}
