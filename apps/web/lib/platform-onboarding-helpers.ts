import type {
  PlatformOnboardingStepId,
  PlatformOnboardingStepStatus,
} from "rapid-cortex-shared";

export const PLATFORM_ONBOARDING_STEP_ORDER: PlatformOnboardingStepId[] = [
  "tenant_created",
  "first_admin",
  "cognito_ready",
  "dns_web",
  "ses",
  "sms",
  "live_video",
  "cad",
  "training",
  "go_live",
];

export function countOnboardingProgress(
  steps: Partial<Record<PlatformOnboardingStepId, PlatformOnboardingStepStatus>> | undefined,
): { complete: number; blocked: number; inProgress: number; total: number } {
  let complete = 0;
  let blocked = 0;
  let inProgress = 0;
  for (const id of PLATFORM_ONBOARDING_STEP_ORDER) {
    const s = steps?.[id] ?? "pending";
    if (s === "complete") complete += 1;
    else if (s === "blocked") blocked += 1;
    else if (s === "in_progress") inProgress += 1;
  }
  return { complete, blocked, inProgress, total: PLATFORM_ONBOARDING_STEP_ORDER.length };
}

export function needsOnboardingAttention(
  agencyStatus: string,
  steps: Partial<Record<PlatformOnboardingStepId, PlatformOnboardingStepStatus>> | undefined,
): boolean {
  if (agencyStatus === "draft") return true;
  if (!steps) return agencyStatus !== "active";
  return Object.values(steps).some((v) => v === "pending" || v === "blocked" || v === "in_progress");
}
