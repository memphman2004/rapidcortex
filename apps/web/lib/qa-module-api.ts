import type {
  CoachingNote,
  CoachingNotesListResponse,
  CreateCoachingNoteBody,
  CreateQaScorecardBody,
  PatchCoachingNoteBody,
  PatchQaScorecardBody,
  QaScorecard,
  QaScorecardsListResponse,
  QaTrendsResponse,
} from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";

const USE_AUTH_PROXY =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";

const DIRECT_API_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "")
    : "";

function apiBase(): string {
  if (USE_AUTH_PROXY) {
    if (typeof window !== "undefined") return `${window.location.origin}/api/backend`;
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    return site ? `${site}/api/backend` : "http://127.0.0.1:3000/api/backend";
  }
  return DIRECT_API_BASE;
}

async function qaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: USE_AUTH_PROXY ? "include" : "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request failed ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export function isQaModuleApiConfigured(): boolean {
  return isApiConfigured();
}

export async function fetchQaScorecards(query?: {
  incidentId?: string;
  dispatcherId?: string;
  limit?: number;
}): Promise<QaScorecard[]> {
  const params = new URLSearchParams();
  if (query?.incidentId) params.set("incidentId", query.incidentId);
  if (query?.dispatcherId) params.set("dispatcherId", query.dispatcherId);
  if (query?.limit) params.set("limit", String(query.limit));
  const q = params.toString();
  const data = await qaRequest<QaScorecardsListResponse>(`/api/qa/scorecards${q ? `?${q}` : ""}`);
  return data.items;
}

export async function fetchQaScorecard(scorecardId: string): Promise<QaScorecard> {
  return qaRequest<QaScorecard>(`/api/qa/scorecards/${encodeURIComponent(scorecardId)}`);
}

export async function postQaScorecard(body: CreateQaScorecardBody): Promise<QaScorecard> {
  return qaRequest<QaScorecard>("/api/qa/scorecards", { method: "POST", body: JSON.stringify(body) });
}

export async function patchQaScorecard(scorecardId: string, body: PatchQaScorecardBody): Promise<QaScorecard> {
  return qaRequest<QaScorecard>(`/api/qa/scorecards/${encodeURIComponent(scorecardId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function acknowledgeQaScorecard(scorecardId: string): Promise<QaScorecard> {
  return qaRequest<QaScorecard>(`/api/qa/scorecards/${encodeURIComponent(scorecardId)}/acknowledge`, {
    method: "POST",
    body: "{}",
  });
}

export async function fetchCoachingNotes(dispatcherId: string, limit = 50): Promise<CoachingNote[]> {
  const params = new URLSearchParams({ dispatcherId, limit: String(limit) });
  const data = await qaRequest<CoachingNotesListResponse>(`/api/qa/coaching-notes?${params}`);
  return data.items;
}

export async function postCoachingNote(body: CreateCoachingNoteBody): Promise<CoachingNote> {
  return qaRequest<CoachingNote>("/api/qa/coaching-notes", { method: "POST", body: JSON.stringify(body) });
}

export async function patchCoachingNote(noteId: string, body: PatchCoachingNoteBody): Promise<CoachingNote> {
  return qaRequest<CoachingNote>(`/api/qa/coaching-notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchQaTrends(query?: {
  period?: "day" | "week" | "month";
  dispatcherId?: string;
  weeks?: number;
}): Promise<QaTrendsResponse> {
  const params = new URLSearchParams();
  if (query?.period) params.set("period", query.period);
  if (query?.dispatcherId) params.set("dispatcherId", query.dispatcherId);
  if (query?.weeks) params.set("weeks", String(query.weeks));
  const q = params.toString();
  return qaRequest<QaTrendsResponse>(`/api/qa/trends${q ? `?${q}` : ""}`);
}
