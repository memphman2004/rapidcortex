/**
 * Shared helpers for ChatGPT Watch → NexiQ Inbox ingest.
 * Pure functions — safe for web and Lambda.
 */

/** Prefer unprefixed `crypto` so Next/webpack client traces do not hit `node:` scheme errors. */
import { createHash } from "crypto";

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
  return createHash("sha256").update(canonical).digest("hex");
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
