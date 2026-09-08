import type { CADSlot, CanonicalIncident, TransferState } from "./schemas.js";
import { oppositeCadSlot } from "./config.js";

export class CadBridgeTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CadBridgeTransferError";
  }
}

export function requestIncidentTransfer(opts: {
  incident: CanonicalIncident;
  requestedBy: string;
  toSlot: CADSlot;
  nowIso: string;
  timeoutSeconds: number;
}): CanonicalIncident {
  const { incident, requestedBy, toSlot, nowIso, timeoutSeconds } = opts;
  if (incident.transferState?.status === "REQUESTED") {
    throw new CadBridgeTransferError("A transfer is already pending for this incident");
  }
  if (toSlot === incident.owner) {
    throw new CadBridgeTransferError("Incident is already owned by the destination CAD");
  }
  const timeoutAt = new Date(Date.parse(nowIso) + timeoutSeconds * 1000).toISOString();
  const transferState: TransferState = {
    status: "REQUESTED",
    fromSlot: incident.owner,
    toSlot,
    requestedAt: nowIso,
    requestedBy,
    timeoutAt,
  };
  return { ...incident, transferState, updatedAt: nowIso, syncState: "SYNC_PENDING" };
}

export function acceptIncidentTransfer(opts: {
  incident: CanonicalIncident;
  acceptedBy: string;
  nowIso: string;
}): CanonicalIncident {
  const { incident, acceptedBy, nowIso } = opts;
  const pending = incident.transferState;
  if (!pending || pending.status !== "REQUESTED") {
    throw new CadBridgeTransferError("No pending transfer to accept");
  }
  if (Date.parse(pending.timeoutAt) <= Date.parse(nowIso)) {
    throw new CadBridgeTransferError("Transfer request has timed out");
  }
  return {
    ...incident,
    owner: pending.toSlot,
    transferState: {
      ...pending,
      status: "ACCEPTED",
      acceptedAt: nowIso,
      acceptedBy,
    },
    updatedAt: nowIso,
  };
}

export function cancelIncidentTransfer(opts: {
  incident: CanonicalIncident;
  nowIso: string;
  timedOut?: boolean;
}): CanonicalIncident {
  const { incident, nowIso, timedOut } = opts;
  const pending = incident.transferState;
  if (!pending || pending.status !== "REQUESTED") {
    throw new CadBridgeTransferError("No pending transfer to cancel");
  }
  return {
    ...incident,
    owner: pending.fromSlot,
    transferState: {
      ...pending,
      status: timedOut ? "TIMED_OUT" : "CANCELLED",
      cancelledAt: nowIso,
    },
    updatedAt: nowIso,
    syncState: incident.pendingConflicts.length > 0 ? "CONFLICT" : "IN_SYNC",
  };
}

export function isTransferTimedOut(incident: CanonicalIncident, nowIso: string): boolean {
  const pending = incident.transferState;
  if (!pending || pending.status !== "REQUESTED") return false;
  return Date.parse(pending.timeoutAt) <= Date.parse(nowIso);
}

export function defaultTransferDestination(incident: CanonicalIncident): CADSlot {
  return oppositeCadSlot(incident.owner);
}
