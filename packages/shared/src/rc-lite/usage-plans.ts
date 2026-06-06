import type { RcLitePricingTierId } from "./pricing-internal.js";

/**
 * Plan metadata for rate limits, quotas, and commercial packaging.
 * Production enforcement should align with API Gateway usage plans or edge workers.
 */

export type RcLiteServiceTierId = "standard" | "priority" | "critical" | "dedicated";

export const RC_LITE_SERVICE_TIERS: readonly {
  id: RcLiteServiceTierId;
  label: string;
  useCase: string;
  notes: string;
}[] = [
  {
    id: "standard",
    label: "Standard",
    useCase: "Batch analysis, async CAD export, scheduled QA workloads.",
    notes: "Default queue; predictable monthly pricing.",
  },
  {
    id: "priority",
    label: "Priority",
    useCase: "Near-real-time integration partners and supervised pilots.",
    notes: "Tighter SLA, higher RPM ceiling, prioritized queue lanes.",
  },
  {
    id: "critical",
    label: "Critical",
    useCase: "Emergency live workflows with contracted incident response escalation.",
    notes: "Hotline escalation path; concurrency negotiated per contract.",
  },
  {
    id: "dedicated",
    label: "Dedicated",
    useCase: "Enterprise/private deployment, sovereign regions, statewide programs.",
    notes: "Isolated infra, configurable burst envelopes, CAD adapter co-development.",
  },
];

export type RcLitePlanLimits = {
  tierId: RcLitePricingTierId;
  includedMonthlyCalls: number | null;
  requestsPerMinute: number | null;
  burstRpmMultiplier: number;
  sandboxRequestsPerMinute: number | null;
  enterpriseBurstRpm: number | null;
  /** Optional per-scope caps (RPM) when policy engine enforces granular throttles. */
  scopeRpmOverrides?: Partial<Record<string, number>>;
};

export const RC_LITE_PLAN_LIMITS: readonly RcLitePlanLimits[] = [
  {
    tierId: "sandbox",
    includedMonthlyCalls: 1_000,
    requestsPerMinute: 30,
    burstRpmMultiplier: 1.2,
    sandboxRequestsPerMinute: 30,
    enterpriseBurstRpm: null,
  },
  {
    tierId: "developer",
    includedMonthlyCalls: 10_000,
    requestsPerMinute: 120,
    burstRpmMultiplier: 1.5,
    sandboxRequestsPerMinute: 60,
    enterpriseBurstRpm: null,
  },
  {
    tierId: "pilot",
    includedMonthlyCalls: 50_000,
    requestsPerMinute: 300,
    burstRpmMultiplier: 2,
    sandboxRequestsPerMinute: 120,
    enterpriseBurstRpm: null,
  },
  {
    tierId: "professional",
    includedMonthlyCalls: 250_000,
    requestsPerMinute: 900,
    burstRpmMultiplier: 2.5,
    sandboxRequestsPerMinute: 300,
    enterpriseBurstRpm: 1_500,
  },
  {
    tierId: "enterprise",
    includedMonthlyCalls: null,
    requestsPerMinute: null,
    burstRpmMultiplier: 3,
    sandboxRequestsPerMinute: 600,
    enterpriseBurstRpm: 5_000,
  },
];
