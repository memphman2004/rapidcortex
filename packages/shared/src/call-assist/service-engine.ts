/**
 * NEXiQ City Services — Service Execution Engine
 *
 * Wraps the existing municipal routing (municipalRouteOverride, classifyMunicipalIssue)
 * with playbook metadata and enriched resolution guidance.
 *
 * CRITICAL: Does NOT replace the existing Lex taxonomy or routing logic.
 *           All existing behavior is preserved when the flag is off.
 *           When enabled, adds structured intake, SLA, and citizen-facing guidance.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: `config.municipalServiceExpansionEnabled === true`
 */

import {
  classifyMunicipalIssue,
  municipalRouteOverride,
  municipalSlaMinutes,
  type MunicipalDepartmentId,
  type MunicipalMatch,
} from "./municipal-services.js";
import {
  getPlaybookForDepartment,
  playbookAutoEscalate,
  playbookConfirmationText,
  playbookIntakeFields,
  playbookSlaMinutes,
  type DepartmentPlaybook,
  type PlaybookField,
} from "./playbook.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceResolutionKind =
  | "emergency"           // Transfer to 911 immediately
  | "lifecycle"           // Status check, reopen, escalate (Phase 1)
  | "department_intake"   // Normal intake to a specific department
  | "information"         // Info/FAQ — no SR created
  | "transfer_human"      // Cannot auto-route — hand to operator
  | "unknown";            // Could not classify

/**
 * Result of resolving a citizen's request through the service engine.
 * Always includes the original routing result for compatibility.
 */
export type ServiceResolutionResult = {
  kind: ServiceResolutionKind;
  departmentId?: MunicipalDepartmentId;
  issueId?: string;
  /** Citizen-facing department display name. */
  departmentDisplayName?: string;
  /** First intake field voice prompt, or undefined. */
  intakePrompt?: string;
  /** SLA in minutes, from playbook or base table. */
  slaMinutes?: number;
  /** True when the utterance triggers auto-escalation for the department. */
  autoEscalate?: boolean;
  /** Underlying municipal match (from classifyMunicipalIssue). */
  municipalMatch?: MunicipalMatch;
  /** Full playbook, when available. */
  playbook?: DepartmentPlaybook;
  /** All intake fields in order. */
  intakeFields?: PlaybookField[];
};

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

/**
 * Returns true when the Municipal Service Expansion is enabled for this tenant.
 * When false, all engine calls fall back to base routing behavior.
 * Default: OFF (opt-in per agency; not a global env var).
 */
export function isMunicipalServiceExpansionEnabled(
  config: { municipalServiceExpansionEnabled?: boolean } | null | undefined,
): boolean {
  return config?.municipalServiceExpansionEnabled === true;
}

// ---------------------------------------------------------------------------
// Core resolution function
// ---------------------------------------------------------------------------

/**
 * Resolve a citizen's utterance or intent to a structured service result.
 *
 * When `enableEnhanced` is false (flag off), returns the base municipal routing
 * result without playbook metadata — today's behavior is preserved.
 *
 * @param utterance  The citizen's spoken or typed text.
 * @param incidentType  Optional Lex intent/classification string.
 * @param enableEnhanced  Pass `isMunicipalServiceExpansionEnabled(config)`.
 */
export function resolveServiceRequest(opts: {
  utterance: string;
  incidentType?: string;
  enableEnhanced?: boolean;
}): ServiceResolutionResult {
  const { utterance, incidentType, enableEnhanced = false } = opts;

  // Base routing — always runs regardless of flag
  const route = municipalRouteOverride(incidentType, utterance);

  if (route.kind === "emergency") {
    return { kind: "emergency" };
  }

  if (!enableEnhanced) {
    // Flag off — return bare result, no playbook metadata
    if (route.kind === "none" || route.kind === "preserve") {
      return { kind: "unknown" };
    }
    return {
      kind: "department_intake",
      departmentId: route.departmentId,
      issueId: route.kind === "issue" ? route.issueId : undefined,
    };
  }

  // --- Enhanced path (flag on) ---
  const municipalMatch = classifyMunicipalIssue(utterance) ?? undefined;

  // Lifecycle check-in handled by Phase 1 — still route here for playbook reference
  const isLifecycleIntent =
    incidentType === "CheckServiceRequestStatus" ||
    /check.*report|status.*report|my report|confirm.*number|reopen|escalate.*report/i.test(utterance);
  if (isLifecycleIntent) {
    return {
      kind: "lifecycle",
      departmentId: "THREE11_OPERATIONS",
      playbook: getPlaybookForDepartment("THREE11_OPERATIONS") ?? undefined,
      intakeFields: playbookIntakeFields("THREE11_OPERATIONS"),
    };
  }

  const isInfoRequest =
    incidentType === "InformationRequest" ||
    /office hours|phone number|website|how do i|where is|what is the/i.test(utterance);
  if (isInfoRequest) {
    return { kind: "information", departmentId: "THREE11_OPERATIONS" };
  }

  if (route.kind === "none" || route.kind === "preserve") {
    return { kind: "unknown", municipalMatch };
  }

  const departmentId = route.departmentId as MunicipalDepartmentId;
  const playbook = getPlaybookForDepartment(departmentId) ?? undefined;
  const slaMinutes = playbookSlaMinutes(departmentId) ?? municipalSlaMinutes(departmentId) ?? undefined;
  const intakeFields = playbookIntakeFields(departmentId);
  const autoEscalate = playbookAutoEscalate(departmentId, utterance);

  return {
    kind: "department_intake",
    departmentId,
    issueId: route.kind === "issue" ? route.issueId : undefined,
    departmentDisplayName: playbook?.displayName,
    intakePrompt: intakeFields[0]?.voicePrompt,
    slaMinutes,
    autoEscalate,
    municipalMatch,
    playbook,
    intakeFields,
  };
}

// ---------------------------------------------------------------------------
// Catalog audit: gap analysis between service-registry and live routing
// ---------------------------------------------------------------------------

/**
 * Returns a lightweight summary comparing the candidate service-registry
 * to the live MUNICIPAL_ISSUES array.
 *
 * Used by the admin dashboard and onboarding wizard to show activation gaps.
 * Does not modify either catalog.
 */
export function catalogGapSummary(opts: {
  serviceRegistryCount: number;
  liveMunicipalIssueCount: number;
  liveDepartments: string[];
}): {
  candidateCount: number;
  liveIssueCount: number;
  activationGap: number;
  coveragePct: number;
  uncoveredDepartments: string[];
} {
  const covered = new Set(opts.liveDepartments);
  const allDepts: MunicipalDepartmentId[] = [
    "PUBLIC_WORKS", "PUBLIC_WORKS_ELECTRICAL", "SANITATION", "WATER_SEWER_AUTHORITY",
    "CODE_ENFORCEMENT", "PARKING_ENFORCEMENT", "ANIMAL_CONTROL", "URBAN_FORESTRY",
    "PARKS_RECREATION", "HOUSING_COMMUNITY_DEV", "ENVIRONMENTAL_QUALITY",
    "POLICE_NON_EMERGENCY", "FIRE_MARSHAL_NON_EMERGENCY", "TRANSIT_AUTHORITY",
    "CITY_CLERK", "SOCIAL_SERVICES", "THREE11_OPERATIONS", "UTILITIES",
  ];
  const uncoveredDepartments = allDepts.filter((d) => !covered.has(d));
  const coveragePct =
    opts.serviceRegistryCount === 0
      ? 0
      : Math.round((opts.liveMunicipalIssueCount / opts.serviceRegistryCount) * 100);

  return {
    candidateCount: opts.serviceRegistryCount,
    liveIssueCount: opts.liveMunicipalIssueCount,
    activationGap: opts.serviceRegistryCount - opts.liveMunicipalIssueCount,
    coveragePct,
    uncoveredDepartments,
  };
}

// ---------------------------------------------------------------------------
// Citizen confirmation helper
// ---------------------------------------------------------------------------

/**
 * Returns the citizen-facing confirmation text for a completed SR,
 * using the playbook template when available.
 * Wraps `playbookConfirmationText` with a safe fallback.
 */
export function serviceConfirmationText(opts: {
  departmentId: string;
  confirmationNumber: string;
}): string {
  return playbookConfirmationText(opts);
}
