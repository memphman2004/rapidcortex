/**
 * Pre-arrival / pre-hospital protocol categories (agency packs may add more later).
 * Distinct from incident triage category on AIAnalysis.
 */
export type ProtocolCategory =
  | "cpr_cardiac_arrest"
  | "aed_use"
  | "choking"
  | "severe_bleeding"
  | "stroke"
  | "unconscious_person"
  | "fire_evacuation"
  | "domestic_disturbance_silent_caller"
  | "welfare_check"
  | "unknown_high_stress";

export type ProtocolStep = {
  id: string;
  order: number;
  /** Short label for the dispatcher UI (not medical instruction by itself). */
  title: string;
  /** Approved wording from protocol — the only line suggested for the dispatcher to say. */
  dispatcherPhrase: string;
  /** Why this step matters (coach framing, still grounded in protocol). */
  rationale: string;
  /** When to escalate or hand off (from protocol, not invented). */
  escalationCriteria: string;
  /** If any substring appears in transcript (case-insensitive), we consider this step satisfied and move on. */
  advanceWhen?: string[];
};

export type ProtocolPack = {
  id: string;
  name: string;
  category: ProtocolCategory;
  locale: string;
  version: string;
  /** If set, pack only applies to these agencies; omit for default (all agencies). */
  agencyIds?: string[];
  /** Keywords to match caller/dispatcher text for protocol selection. */
  identificationKeywords: string[];
  protocolEscalationSummary: string;
  steps: ProtocolStep[];
};

/** Attached to AIAnalysis — all instructional wording originates from protocol packs, not the LLM. */
export type ProtocolGuidance = {
  protocolId: string;
  protocolName: string;
  category: ProtocolCategory;
  locale: string;
  currentStepId: string;
  currentStepOrder: number;
  currentStepTitle: string;
  recommendedPhrase: string;
  rationale: string;
  escalationCriteria: string;
  protocolEscalationSummary: string;
  coachDisclaimer: string;
};
