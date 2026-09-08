import { createHash, randomUUID } from "node:crypto";
import type { SQSEvent, SQSRecord } from "aws-lambda";
import type {
  BridgeAuditRecord,
  BridgeEvent,
  BridgeOutcome,
  CADSlot,
  CanonicalIncident,
} from "rapid-cortex-shared";
import {
  detectCadBridgeConflicts,
  dropCanonicalFields,
  isSecondaryCloseWhilePrimaryActive,
  mergeCanonicalIncident,
  oppositeCadSlot,
  resolveCadBridgeConflicts,
  shouldSyncEvent,
} from "rapid-cortex-shared";
import { getCadBridgeAdapter } from "./adapters/index.js";
import { emitCadBridgeMetrics } from "./metrics.js";
import { publishCadBridgeEvent } from "./publisher.js";
import { cadBridgeStore } from "./store.js";
import { applyTransferEvent } from "./transfer-runtime.js";

export async function handleCadBridgeSqsEvent(sqsEvent: SQSEvent): Promise<void> {
  for (const record of sqsEvent.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const start = Date.now();
  let bridgeEvent: BridgeEvent;
  try {
    bridgeEvent = JSON.parse(record.body) as BridgeEvent;
  } catch {
    console.error("[cad-bridge.router] failed to parse SQS body");
    return;
  }

  const audit: Partial<BridgeAuditRecord> = {
    agencyId: bridgeEvent.agencyId,
    eventId: bridgeEvent.eventId,
    direction: bridgeEvent.sourceSlot === "CAD_A" ? "CAD_A_TO_B" : "CAD_B_TO_A",
    eventType: bridgeEvent.eventType,
    sourceIncidentId: bridgeEvent.sourceIncidentId,
    sourcePayloadHash: hashPayload(bridgeEvent.rawPayload),
    timestamp: new Date().toISOString(),
    rcIncidentId: "UNRESOLVED",
  };

  try {
    const config = await cadBridgeStore.getConfig(bridgeEvent.agencyId);
    if (!config?.enabled) {
      audit.outcome = "SKIPPED";
      return;
    }
    if (!shouldSyncEvent(bridgeEvent.eventType, config.syncRules)) {
      audit.outcome = "SKIPPED";
      return;
    }

    const sourceVendor = bridgeEvent.sourceSlot === "CAD_A" ? config.cadA.vendor : config.cadB.vendor;
    const adapter = getCadBridgeAdapter(sourceVendor);
    let canonicalChanges = adapter.toCanonical(bridgeEvent);

    let incident = await cadBridgeStore.getIncidentByVendorId(
      bridgeEvent.agencyId,
      bridgeEvent.sourceSlot,
      bridgeEvent.sourceIncidentId,
    );
    const isNewIncident = !incident;

    if (isNewIncident) {
      if (bridgeEvent.eventType !== "INCIDENT_CREATED") {
        audit.outcome = "SKIPPED";
        return;
      }
      incident = buildNewCanonicalIncident(
        bridgeEvent.agencyId,
        bridgeEvent.sourceSlot,
        bridgeEvent.sourceIncidentId,
        config,
        canonicalChanges,
      );
    } else if (
      isSecondaryCloseWhilePrimaryActive(bridgeEvent.eventType, bridgeEvent.sourceSlot, incident)
    ) {
      const nowIso = new Date().toISOString();
      const conflict = {
        conflictId: randomUUID(),
        field: "status",
        cadAValue: bridgeEvent.sourceSlot === "CAD_A" ? "CLOSED" : incident.status,
        cadBValue: bridgeEvent.sourceSlot === "CAD_B" ? "CLOSED" : incident.status,
        cadATimestamp: nowIso,
        cadBTimestamp: nowIso,
        detectedAt: nowIso,
      };
      incident = {
        ...incident,
        pendingConflicts: [...incident.pendingConflicts, conflict],
        syncState: "CONFLICT",
        updatedAt: nowIso,
      };
      await cadBridgeStore.saveIncident(incident);
      await cadBridgeStore.putConflict(incident.agencyId, incident.rcIncidentId, conflict);
      await emitCadBridgeMetrics({
        agencyId: incident.agencyId,
        conflictCount: 1,
        unresolvedConflicts: 1,
      });
      audit.rcIncidentId = incident.rcIncidentId;
      audit.outcome = "CONFLICT";
      audit.conflictIds = [conflict.conflictId];
      return;
    } else {
      const nowIso = new Date().toISOString();
      const conflicts = detectCadBridgeConflicts(
        {
          existing: incident,
          incoming: canonicalChanges,
          sourceSlot: bridgeEvent.sourceSlot,
          nowIso,
          makeConflictId: () => randomUUID(),
        },
        config,
      );
      if (conflicts.length > 0) {
        const resolved = resolveCadBridgeConflicts(conflicts, config, nowIso);
        canonicalChanges = dropCanonicalFields(canonicalChanges, resolved.dropFields);
        const pending = [...incident.pendingConflicts, ...resolved.unresolved];
        for (const conflict of resolved.unresolved) {
          await cadBridgeStore.putConflict(incident.agencyId, incident.rcIncidentId, conflict);
        }
        incident = {
          ...incident,
          pendingConflicts: pending,
          syncState: resolved.unresolved.length > 0 ? "CONFLICT" : incident.syncState,
        };
        audit.conflictIds = resolved.unresolved.map((c) => c.conflictId);
        if (resolved.unresolved.length > 0) {
          await emitCadBridgeMetrics({
            agencyId: incident.agencyId,
            conflictCount: resolved.unresolved.length,
            unresolvedConflicts: resolved.unresolved.length,
          });
        }
      }
      incident = mergeCanonicalIncident(incident, canonicalChanges, bridgeEvent.sourceSlot, nowIso);
    }

    if (
      bridgeEvent.eventType === "UNIT_STATUS_CHANGED" &&
      canonicalChanges.units?.length &&
      !canonicalChanges.units.some((u) => incident!.units.some((existing) => existing.unitId === u.unitId))
    ) {
      audit.rcIncidentId = incident.rcIncidentId;
      audit.outcome = "SKIPPED";
      audit.errorDetail = "Unit is not assigned to a shared incident";
      await cadBridgeStore.saveIncident(incident);
      return;
    }

    if (
      bridgeEvent.eventType === "TRANSFER_REQUESTED" ||
      bridgeEvent.eventType === "TRANSFER_ACCEPTED" ||
      bridgeEvent.eventType === "TRANSFER_CANCELLED"
    ) {
      incident = applyTransferEvent(incident, bridgeEvent, config);
    }

    audit.rcIncidentId = incident.rcIncidentId;
    const destinationSlot: CADSlot = oppositeCadSlot(bridgeEvent.sourceSlot);
    const destConfig = destinationSlot === "CAD_A" ? config.cadA : config.cadB;
    if (!destConfig.outboundEnabled) {
      await cadBridgeStore.saveIncident(incident);
      audit.outcome = "SKIPPED";
      return;
    }

    const destVendor = destConfig.vendor;
    const destAdapter = getCadBridgeAdapter(destVendor);
    const destinationIncidentId =
      destinationSlot === "CAD_A" ? incident.cadA.incidentId : incident.cadB.incidentId;

    const publishResult = await publishCadBridgeEvent({
      incident,
      eventType: bridgeEvent.eventType,
      canonicalChanges,
      destinationSlot,
      destinationIncidentId,
      destAdapter,
      config,
      isNewIncident: isNewIncident && !destinationIncidentId,
      receivedAt: bridgeEvent.receivedAt,
    });

    if (publishResult.createdIncidentId) {
      if (destinationSlot === "CAD_A") {
        incident = {
          ...incident,
          cadA: { ...incident.cadA, incidentId: publishResult.createdIncidentId, lastSyncedAt: new Date().toISOString() },
        };
      } else {
        incident = {
          ...incident,
          cadB: { ...incident.cadB, incidentId: publishResult.createdIncidentId, lastSyncedAt: new Date().toISOString() },
        };
      }
    }

    if (publishResult.outcome === "SUCCESS") {
      incident = {
        ...incident,
        syncState: incident.pendingConflicts.length > 0 ? "CONFLICT" : "IN_SYNC",
      };
    } else if (publishResult.outcome === "BUFFERED") {
      incident = { ...incident, syncState: "BUFFERED" };
    } else if (publishResult.outcome !== "SKIPPED") {
      incident = { ...incident, syncState: "ERROR" };
    }

    incident = { ...incident, updatedAt: new Date().toISOString() };
    await cadBridgeStore.saveIncident(incident);
    audit.destinationIncidentId = publishResult.createdIncidentId ?? destinationIncidentId;
    audit.outboundPayloadHash = publishResult.outboundPayloadHash;
    audit.outcome = publishResult.outcome;
    audit.errorCode = publishResult.errorCode;
    audit.errorDetail = publishResult.errorDetail;
  } catch (err) {
    audit.outcome = "FAILED";
    audit.errorDetail = "router_error";
    console.error("[cad-bridge.router] unhandled error", {
      agencyId: bridgeEvent.agencyId,
      eventId: bridgeEvent.eventId,
      message: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    await cadBridgeStore.putAudit({
      agencyId: audit.agencyId ?? bridgeEvent.agencyId,
      eventId: bridgeEvent.eventId,
      rcIncidentId: audit.rcIncidentId ?? "UNRESOLVED",
      direction: audit.direction ?? "CAD_A_TO_B",
      eventType: bridgeEvent.eventType,
      sourceIncidentId: bridgeEvent.sourceIncidentId,
      destinationIncidentId: audit.destinationIncidentId,
      sourcePayloadHash: audit.sourcePayloadHash ?? "",
      outboundPayloadHash: audit.outboundPayloadHash,
      outcome: (audit.outcome ?? "FAILED") as BridgeOutcome,
      conflictIds: audit.conflictIds,
      errorCode: audit.errorCode,
      errorDetail: audit.errorDetail,
      durationMs: Date.now() - start,
      timestamp: audit.timestamp ?? new Date().toISOString(),
    });
  }
}

function buildNewCanonicalIncident(
  agencyId: string,
  sourceSlot: CADSlot,
  sourceIncidentId: string,
  config: { cadA: { vendor: CanonicalIncident["cadA"]["vendor"] }; cadB: { vendor: CanonicalIncident["cadB"]["vendor"] } },
  changes: Partial<CanonicalIncident>,
): CanonicalIncident {
  const now = new Date().toISOString();
  return {
    rcIncidentId: randomUUID(),
    agencyId,
    owner: sourceSlot,
    cadA: {
      incidentId: sourceSlot === "CAD_A" ? sourceIncidentId : "",
      vendor: config.cadA.vendor,
      lastSyncedAt: sourceSlot === "CAD_A" ? now : "",
      lastVersion: "",
    },
    cadB: {
      incidentId: sourceSlot === "CAD_B" ? sourceIncidentId : undefined,
      vendor: config.cadB.vendor,
      lastSyncedAt: sourceSlot === "CAD_B" ? now : undefined,
    },
    type: changes.type ?? "UNKNOWN",
    priority: changes.priority ?? 3,
    status: changes.status ?? "ACTIVE",
    location: changes.location ?? { address: "", city: "", state: "" },
    caller: changes.caller ?? {},
    narrative: changes.narrative ?? "",
    units: changes.units ?? [],
    comments: changes.comments ?? [],
    syncState: "PENDING_MIRROR",
    pendingConflicts: [],
    createdAt: changes.createdAt ?? now,
    updatedAt: now,
  };
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
