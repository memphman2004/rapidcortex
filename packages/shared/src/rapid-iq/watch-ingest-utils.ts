/**
 * Shared helpers for ChatGPT Watch → NexiQ Inbox ingest.
 * Pure functions — safe for web, Lambda, and React Native (no Node crypto).
 */

import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

/** Normalize external_key for lookup without inventing a new key on title edits. */
export function normalizeWatchExternalKey(key: string): string {
  return key.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 300);
}

/** Stable JSON for payload hashing (sorted keys, no volatile timestamps). */
export function canonicalizeForWatchHash(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalizeForWatchHash);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    if (k === "ingestedAt" || k === "retrievedAt" || k === "last_watch_update_at") continue;
    out[k] = canonicalizeForWatchHash(obj[k]);
  }
  return out;
}

export function watchPayloadHash(payload: unknown): string {
  const canonical = JSON.stringify(canonicalizeForWatchHash(payload));
  return bytesToHex(sha256(utf8ToBytes(canonical)));
}

export type WatchDeadlineBucket =
  | "overdue"
  | "due_today"
  | "due_within_3_days"
  | "due_within_7_days"
  | "due_within_14_days"
  | "future"
  | "unknown";

/** Derive deadline urgency from an ISO date / datetime string (date portion). */
export function watchDeadlineBucket(
  dueDate: string | null | undefined,
  now = new Date(),
): WatchDeadlineBucket {
  if (!dueDate?.trim()) return "unknown";
  const day = dueDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "unknown";
  const due = new Date(`${day}T23:59:59.999Z`);
  if (Number.isNaN(due.getTime())) return "unknown";
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((due.getTime() - start.getTime()) / msPerDay);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due_today";
  if (diffDays <= 3) return "due_within_3_days";
  if (diffDays <= 7) return "due_within_7_days";
  if (diffDays <= 14) return "due_within_14_days";
  return "future";
}

export type WatchPriorityInput = {
  fit?: "high" | "medium" | "low" | null;
  strength?: "weak" | "moderate" | "strong" | "confirmed" | null;
  buyingStage?: string | null;
  dueDate?: string | null;
  fundingIdentified?: boolean;
  hasAuthoritativeEvidence?: boolean;
  lifecycleChange?: string | null;
  hasPainPoints?: boolean;
  matchedCapabilityCount?: number;
  now?: Date;
};

export type WatchPriorityLabel = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

/** Deterministic UI sort score — not win probability. */
export function computeWatchPriorityScore(input: WatchPriorityInput): {
  priority_score: number;
  priority_label: WatchPriorityLabel;
} {
  let score = 0;
  if (input.fit === "high") score += 30;
  else if (input.fit === "medium") score += 15;

  if (input.strength === "confirmed") score += 25;
  else if (input.strength === "strong") score += 15;
  else if (input.strength === "moderate") score += 8;

  const stage = (input.buyingStage ?? "").toLowerCase();
  if (stage === "procurement_live" || stage === "rfp") score += 30;
  else if (stage === "evaluating") score += 22;
  else if (stage === "funded") score += 18;
  else if (stage === "planning") score += 10;

  if (input.fundingIdentified) score += 10;
  if (input.hasAuthoritativeEvidence) score += 10;
  if (input.hasPainPoints) score += 5;
  if ((input.matchedCapabilityCount ?? 0) > 0) score += Math.min(10, input.matchedCapabilityCount! * 2);

  const bucket = watchDeadlineBucket(input.dueDate, input.now);
  if (bucket === "overdue" || bucket === "due_today" || bucket === "due_within_3_days") score += 15;
  else if (bucket === "due_within_7_days" || bucket === "due_within_14_days") score += 8;

  const change = (input.lifecycleChange ?? "").toLowerCase();
  if (change === "vendor_demo") score += 15;
  if (change === "new" || change === "addendum") score += 20;
  if (change === "award") score += 10;
  if (change === "deadline_change") score += 12;

  const priority_score = Math.max(0, Math.min(100, score));
  let priority_label: WatchPriorityLabel = "LOW";
  if (priority_score >= 75) priority_label = "URGENT";
  else if (priority_score >= 55) priority_label = "HIGH";
  else if (priority_score >= 35) priority_label = "MEDIUM";
  return { priority_score, priority_label };
}
