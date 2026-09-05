export const CAMPUS_COUNSELOR_QUEUE_TYPES = ["mental_health", "wellness_check"] as const;

export type CampusCounselorQueueType = (typeof CAMPUS_COUNSELOR_QUEUE_TYPES)[number];

export function isCampusCounselorQueueType(type: string): boolean {
  return (CAMPUS_COUNSELOR_QUEUE_TYPES as readonly string[]).includes(type);
}
