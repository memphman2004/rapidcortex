import type {
  CADBridgeConfig,
  CADSlot,
  CanonicalIncident,
  ConflictRecord,
  ConflictStrategy,
} from "./schemas.js";

const SCALAR_CONFLICT_FIELDS = ["priority", "type", "status"] as const;

export interface ConflictDetectionInput {
  existing: CanonicalIncident;
  incoming: Partial<CanonicalIncident>;
  sourceSlot: CADSlot;
  nowIso: string;
  makeConflictId: () => string;
}

/**
 * Conflicts are only flagged when a non-owner CAD changes an authoritative field.
 * Location from the non-primary CAD always queues for supervisor action.
 */
export function detectCadBridgeConflicts(
  input: ConflictDetectionInput,
  config: CADBridgeConfig,
): ConflictRecord[] {
  const { existing, incoming, sourceSlot, nowIso, makeConflictId } = input;
  const conflicts: ConflictRecord[] = [];

  if (incoming.location !== undefined && sourceSlot !== config.primaryCAD) {
    if (JSON.stringify(existing.location) !== JSON.stringify(incoming.location)) {
      conflicts.push(
        conflictRow({
          id: makeConflictId(),
          field: "location",
          existing: existing.location,
          incoming: incoming.location,
          sourceSlot,
          nowIso,
        }),
      );
    }
  }

  if (sourceSlot === existing.owner) return conflicts;

  for (const field of SCALAR_CONFLICT_FIELDS) {
    const incomingVal = incoming[field];
    if (incomingVal === undefined) continue;
    if (JSON.stringify(existing[field]) === JSON.stringify(incomingVal)) continue;
    conflicts.push(
      conflictRow({
        id: makeConflictId(),
        field,
        existing: existing[field],
        incoming: incomingVal,
        sourceSlot,
        nowIso,
      }),
    );
  }

  return conflicts;
}

function conflictRow(args: {
  id: string;
  field: string;
  existing: unknown;
  incoming: unknown;
  sourceSlot: CADSlot;
  nowIso: string;
}): ConflictRecord {
  const { id, field, existing, incoming, sourceSlot, nowIso } = args;
  return {
    conflictId: id,
    field,
    cadAValue: sourceSlot === "CAD_A" ? incoming : existing,
    cadBValue: sourceSlot === "CAD_B" ? incoming : existing,
    cadATimestamp: nowIso,
    cadBTimestamp: nowIso,
    detectedAt: nowIso,
  };
}

export interface ConflictResolutionResult {
  unresolved: ConflictRecord[];
  /** Fields that should be stripped from the incoming delta (keep existing / wait for review). */
  dropFields: string[];
  resolved: ConflictRecord[];
}

export function resolveCadBridgeConflicts(
  conflicts: ConflictRecord[],
  config: CADBridgeConfig,
  nowIso: string,
): ConflictResolutionResult {
  const unresolved: ConflictRecord[] = [];
  const resolved: ConflictRecord[] = [];
  const dropFields: string[] = [];

  for (const conflict of conflicts) {
    const strategy: ConflictStrategy =
      conflict.field === "location" ? "MANUAL_REVIEW" : config.conflictResolution;

    if (strategy === "MANUAL_REVIEW") {
      unresolved.push(conflict);
      dropFields.push(conflict.field);
      continue;
    }

    const next: ConflictRecord = {
      ...conflict,
      resolvedAt: nowIso,
      resolution: strategy,
      resolvedBy: "SYSTEM",
    };
    resolved.push(next);
    if (strategy === "PRIMARY_WINS") {
      dropFields.push(conflict.field);
    }
  }

  return { unresolved, dropFields, resolved };
}

export function dropCanonicalFields(
  incoming: Partial<CanonicalIncident>,
  fields: string[],
): Partial<CanonicalIncident> {
  const next = { ...incoming };
  for (const field of fields) {
    delete next[field as keyof CanonicalIncident];
  }
  return next;
}

export function mergeCanonicalIncident(
  existing: CanonicalIncident,
  incoming: Partial<CanonicalIncident>,
  sourceSlot: CADSlot,
  nowIso: string,
): CanonicalIncident {
  const next: CanonicalIncident = { ...existing };

  if (incoming.type !== undefined) next.type = incoming.type;
  if (incoming.priority !== undefined) next.priority = incoming.priority;
  if (incoming.status !== undefined) next.status = incoming.status;
  if (incoming.narrative !== undefined) next.narrative = incoming.narrative;
  if (incoming.location !== undefined) next.location = incoming.location;
  if (incoming.caller !== undefined) next.caller = incoming.caller;
  if (incoming.closedAt !== undefined) next.closedAt = incoming.closedAt;

  if (incoming.units !== undefined) {
    const otherUnits = existing.units.filter((u) => u.cadSlot !== sourceSlot);
    next.units = [...otherUnits, ...incoming.units];
  }

  if (incoming.comments !== undefined) {
    const existingIds = new Set(existing.comments.map((c) => c.commentId));
    next.comments = [
      ...existing.comments,
      ...incoming.comments.filter((c) => !existingIds.has(c.commentId)),
    ];
  }

  if (sourceSlot === "CAD_A") {
    next.cadA = { ...next.cadA, lastSyncedAt: nowIso };
  } else if (next.cadB.incidentId) {
    next.cadB = { ...next.cadB, lastSyncedAt: nowIso };
  }

  next.updatedAt = nowIso;
  return next;
}

export function isSecondaryCloseWhilePrimaryActive(
  eventType: CanonicalIncident["status"] | string,
  sourceSlot: CADSlot,
  incident: CanonicalIncident,
): boolean {
  if (eventType !== "INCIDENT_CLOSED" && eventType !== "INCIDENT_CANCELLED") return false;
  if (sourceSlot === incident.owner) return false;
  return incident.status !== "CLOSED" && incident.status !== "CANCELLED";
}
