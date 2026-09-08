import {
  applyTransferOutcome,
  isOpenTransferAttempt,
  nextTransferAttempt,
  type CallAssistTransferLedgerEntry,
  type RoutingDestinationType,
  type TransferLedgerChannel,
  type TransferLedgerOutcome,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore } from "./store.js";

const auditRepo = new AuditRepository();

export async function recordTransferAttempt(opts: {
  agencyId: string;
  sessionId: string;
  actorId: string;
  destinationType: RoutingDestinationType;
  destinationId: string;
  destinationDisplay: string;
  channel: TransferLedgerChannel;
  outcome?: TransferLedgerOutcome;
  failureReason?: string;
  fallbackTo?: string;
}): Promise<CallAssistTransferLedgerEntry> {
  const existing = await callAssistStore.listTransfers(opts.agencyId, opts.sessionId);
  const now = new Date().toISOString();
  const entry: CallAssistTransferLedgerEntry = {
    ledgerId: makeId("xfer"),
    agencyId: opts.agencyId,
    sessionId: opts.sessionId,
    attempt: nextTransferAttempt(existing),
    destinationType: opts.destinationType,
    destinationId: opts.destinationId,
    destinationDisplay: opts.destinationDisplay,
    channel: opts.channel,
    outcome: opts.outcome ?? "INITIATED",
    failureReason: opts.failureReason,
    fallbackTo: opts.fallbackTo,
    startedAt: now,
    endedAt: opts.outcome && opts.outcome !== "INITIATED" && opts.outcome !== "RINGING" ? now : undefined,
    actorId: opts.actorId,
  };
  await callAssistStore.putTransfer(entry);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_TRANSFER_OUTCOME,
    details: {
      ledgerId: entry.ledgerId,
      attempt: entry.attempt,
      outcome: entry.outcome,
      destinationType: entry.destinationType,
      destinationId: entry.destinationId,
      channel: entry.channel,
      failureReason: entry.failureReason,
      fallbackTo: entry.fallbackTo,
    },
    createdAt: now,
    resourceType: "session",
    resourceId: opts.sessionId,
  });
  return entry;
}

export async function closeOpenTransferAttempts(opts: {
  agencyId: string;
  sessionId: string;
  actorId: string;
  outcome: TransferLedgerOutcome;
  failureReason?: string;
  fallbackTo?: string;
}): Promise<CallAssistTransferLedgerEntry[]> {
  const existing = await callAssistStore.listTransfers(opts.agencyId, opts.sessionId);
  const updated: CallAssistTransferLedgerEntry[] = [];
  const failed =
    opts.outcome === "FAILED" ||
    opts.outcome === "NO_ANSWER" ||
    opts.outcome === "BUSY" ||
    opts.outcome === "REJECTED";
  for (const row of existing) {
    if (!isOpenTransferAttempt(row)) continue;
    const next = applyTransferOutcome(row, opts.outcome, {
      failureReason: opts.failureReason,
      fallbackTo: opts.fallbackTo ?? row.fallbackTo,
    });
    await callAssistStore.putTransfer(next);
    updated.push(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_TRANSFER_OUTCOME,
      details: {
        ledgerId: next.ledgerId,
        attempt: next.attempt,
        outcome: next.outcome,
        destinationId: next.destinationId,
        failureReason: next.failureReason,
        fallbackTo: next.fallbackTo,
      },
      createdAt: next.endedAt ?? new Date().toISOString(),
      resourceType: "session",
      resourceId: opts.sessionId,
    });
    const fallbackDest = opts.fallbackTo ?? row.fallbackTo;
    if (failed && fallbackDest) {
      const fallback = await recordTransferAttempt({
        agencyId: opts.agencyId,
        sessionId: opts.sessionId,
        actorId: opts.actorId,
        destinationType: row.destinationType,
        destinationId: fallbackDest,
        destinationDisplay: fallbackDest,
        channel: row.channel,
        outcome: "FALLBACK",
        failureReason: `fallback_after_${opts.outcome}`,
      });
      updated.push(fallback);
    }
  }
  return updated;
}
