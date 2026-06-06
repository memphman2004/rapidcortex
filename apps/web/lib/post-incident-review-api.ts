import type {
  CreatePostIncidentReviewBody,
  PatchPostIncidentReviewBody,
  PostIncidentReview,
  PostIncidentReviewExport,
  PostIncidentReviewStatus,
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

async function reviewRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export function isPostIncidentReviewApiConfigured(): boolean {
  return isApiConfigured();
}

export async function createPostIncidentReview(body: CreatePostIncidentReviewBody): Promise<PostIncidentReview> {
  return reviewRequest("/api/reviews", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchPostIncidentReviews(query?: {
  incidentId?: string;
  status?: PostIncidentReviewStatus;
}): Promise<PostIncidentReview[]> {
  const params = new URLSearchParams();
  if (query?.incidentId) params.set("incidentId", query.incidentId);
  if (query?.status) params.set("status", query.status);
  const q = params.toString();
  const data = await reviewRequest<{ items: PostIncidentReview[] }>(`/api/reviews${q ? `?${q}` : ""}`);
  return data.items;
}

export async function fetchPostIncidentReview(reviewId: string): Promise<PostIncidentReview> {
  return reviewRequest(`/api/reviews/${encodeURIComponent(reviewId)}`);
}

export async function patchPostIncidentReview(
  reviewId: string,
  body: PatchPostIncidentReviewBody,
): Promise<PostIncidentReview> {
  return reviewRequest(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function exportPostIncidentReview(reviewId: string): Promise<PostIncidentReviewExport> {
  return reviewRequest(`/api/reviews/${encodeURIComponent(reviewId)}/export`);
}

export function downloadReviewExport(data: PostIncidentReviewExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `post-incident-review-${data.reviewId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
