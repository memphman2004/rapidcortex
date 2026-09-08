import { z } from "zod";
import { ROUTING_DESTINATION_TYPES } from "./classifications.js";

export const TRANSFER_LEDGER_OUTCOMES = [
  "INITIATED",
  "RINGING",
  "ANSWERED",
  "FAILED",
  "NO_ANSWER",
  "BUSY",
  "REJECTED",
  "FALLBACK",
  "COMPLETED",
  "CANCELLED",
  "CONFIG_BLOCKED",
] as const;
export type TransferLedgerOutcome = (typeof TRANSFER_LEDGER_OUTCOMES)[number];

export const TRANSFER_LEDGER_CHANNELS = ["PSTN", "SIP", "QUEUE", "CALLBACK", "UNKNOWN"] as const;
export type TransferLedgerChannel = (typeof TRANSFER_LEDGER_CHANNELS)[number];

export const callAssistTransferLedgerEntrySchema = z.object({
  ledgerId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  attempt: z.number().int().min(1).max(20),
  destinationType: z.enum(ROUTING_DESTINATION_TYPES),
  destinationId: z.string().min(1).max(128),
  destinationDisplay: z.string().max(200),
  channel: z.enum(TRANSFER_LEDGER_CHANNELS),
  outcome: z.enum(TRANSFER_LEDGER_OUTCOMES),
  failureReason: z.string().max(500).optional(),
  fallbackTo: z.string().max(128).optional(),
  startedAt: z.string().min(1),
  endedAt: z.string().max(40).optional(),
  actorId: z.string().max(128).optional(),
});
export type CallAssistTransferLedgerEntry = z.infer<typeof callAssistTransferLedgerEntrySchema>;

export const callAssistTransferOutcomeBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  outcome: z.enum(TRANSFER_LEDGER_OUTCOMES),
  failureReason: z.string().max(500).optional(),
  destinationId: z.string().max(128).optional(),
});

export function nextTransferAttempt(existing: CallAssistTransferLedgerEntry[]): number {
  return existing.reduce((max, row) => Math.max(max, row.attempt), 0) + 1;
}

export function applyTransferOutcome(
  entry: CallAssistTransferLedgerEntry,
  outcome: TransferLedgerOutcome,
  opts?: { failureReason?: string; fallbackTo?: string; endedAt?: string },
): CallAssistTransferLedgerEntry {
  return {
    ...entry,
    outcome,
    failureReason: opts?.failureReason ?? entry.failureReason,
    fallbackTo: opts?.fallbackTo ?? entry.fallbackTo,
    endedAt: opts?.endedAt ?? new Date().toISOString(),
  };
}

export function isOpenTransferAttempt(entry: CallAssistTransferLedgerEntry): boolean {
  return entry.outcome === "INITIATED" || entry.outcome === "RINGING";
}

export function summarizeTransferLedger(entries: CallAssistTransferLedgerEntry[]): {
  attempts: number;
  answered: number;
  failed: number;
  fallbacks: number;
  lastOutcome: TransferLedgerOutcome | null;
} {
  return {
    attempts: entries.length,
    answered: entries.filter((e) => e.outcome === "ANSWERED" || e.outcome === "COMPLETED").length,
    failed: entries.filter((e) =>
      e.outcome === "FAILED" || e.outcome === "NO_ANSWER" || e.outcome === "BUSY" || e.outcome === "REJECTED" || e.outcome === "CONFIG_BLOCKED",
    ).length,
    fallbacks: entries.filter((e) => e.outcome === "FALLBACK").length,
    lastOutcome: entries[entries.length - 1]?.outcome ?? null,
  };
}
