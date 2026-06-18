import { z } from "zod";
import {
  ONBOARDING_CHECKLIST_CAMPUS_STEP_IDS,
  ONBOARDING_CHECKLIST_SHARED_STEP_IDS,
  ONBOARDING_CHECKLIST_VENUE_STEP_IDS,
  type OnboardingChecklistStepId,
  type OnboardingVertical,
} from "./types.js";

const stepStatusSchema = z.enum(["pending", "complete"]);

const sharedStepsShape = Object.fromEntries(
  ONBOARDING_CHECKLIST_SHARED_STEP_IDS.map((id) => [id, stepStatusSchema.optional()]),
) as Record<(typeof ONBOARDING_CHECKLIST_SHARED_STEP_IDS)[number], z.ZodOptional<typeof stepStatusSchema>>;

const campusStepsShape = Object.fromEntries(
  ONBOARDING_CHECKLIST_CAMPUS_STEP_IDS.map((id) => [id, stepStatusSchema.optional()]),
) as Record<(typeof ONBOARDING_CHECKLIST_CAMPUS_STEP_IDS)[number], z.ZodOptional<typeof stepStatusSchema>>;

const venueStepsShape = Object.fromEntries(
  ONBOARDING_CHECKLIST_VENUE_STEP_IDS.map((id) => [id, stepStatusSchema.optional()]),
) as Record<(typeof ONBOARDING_CHECKLIST_VENUE_STEP_IDS)[number], z.ZodOptional<typeof stepStatusSchema>>;

const notesShape = z.record(z.string(), z.string().trim().max(2000)).optional();

export const onboardingChecklistPatchSchema = z
  .object({
    steps: z
      .object({
        ...sharedStepsShape,
        ...campusStepsShape,
        ...venueStepsShape,
      })
      .strict()
      .optional(),
    notesByStep: notesShape,
  })
  .strict();

export type OnboardingChecklistPatch = z.infer<typeof onboardingChecklistPatchSchema>;

export function checklistStepsForVertical(vertical: OnboardingVertical): readonly OnboardingChecklistStepId[] {
  const shared = ONBOARDING_CHECKLIST_SHARED_STEP_IDS as readonly OnboardingChecklistStepId[];
  if (vertical === "campus") {
    return [...shared, ...(ONBOARDING_CHECKLIST_CAMPUS_STEP_IDS as readonly OnboardingChecklistStepId[])];
  }
  return [...shared, ...(ONBOARDING_CHECKLIST_VENUE_STEP_IDS as readonly OnboardingChecklistStepId[])];
}

export function countChecklistCompletion(
  vertical: OnboardingVertical,
  steps: Partial<Record<OnboardingChecklistStepId, "pending" | "complete">>,
): { completed: number; total: number; percent: number } {
  const ids = checklistStepsForVertical(vertical);
  const completed = ids.filter((id) => steps[id] === "complete").length;
  const total = ids.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
