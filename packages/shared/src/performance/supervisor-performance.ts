import { z } from "zod";

export const postDispatcherCoachingNoteBodySchema = z.object({
  dispatcherUserId: z.string().min(1).max(128),
  body: z.string().min(1).max(8000),
});
export type PostDispatcherCoachingNoteBody = z.infer<typeof postDispatcherCoachingNoteBodySchema>;

export type DispatcherActivityBucket = {
  day: string;
  transcriptAppends: number;
};

export type DispatcherLeaderboardRow = {
  dispatcherUserId: string;
  transcriptAppends: number;
};

export type SupervisorPerformanceMetricsResponse = {
  agencyId: string;
  period: { from: string; to: string };
  comparison?: { from: string; to: string };
  leaderboard: DispatcherLeaderboardRow[];
  comparisonLeaderboard?: DispatcherLeaderboardRow[];
  /** Coaching notes are never included here — supervisor detail endpoint only. */
};

export type DispatcherCoachingNoteRecord = {
  noteId: string;
  agencyId: string;
  dispatcherUserId: string;
  supervisorUserId: string;
  body: string;
  createdAt: string;
};

export type DispatcherPerformanceDetailResponse = {
  agencyId: string;
  dispatcherUserId: string;
  period: { from: string; to: string };
  comparison?: { from: string; to: string };
  activity: DispatcherActivityBucket[];
  comparisonActivity?: DispatcherActivityBucket[];
  coachingNotes: DispatcherCoachingNoteRecord[];
};
