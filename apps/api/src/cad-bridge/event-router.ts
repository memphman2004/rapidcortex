import { createHash, randomUUID } from "node:crypto";
import type { SQSEvent, SQSRecord } from "aws-lambda";
import type {
  BridgeAuditRecord,
  BridgeEvent,
  BridgeOutcome,
  CADBridgeConfig,
  CADSlot,
  CanonicalIncident,
} from "rapid-cortex-shared";
import {
  cadBridgeAuditDirection,
  detectCadBridgeConflicts,
  dropCanonicalFields,
  fanoutCadSlots,
  getCadSlotConfig,
  getIncidentLink,
  isCadBridgeExtraSlot,
  isSecondaryCloseWhilePrimaryActive,
  mergeCanonicalIncident,
  resolveCadBridgeConflicts,
  setIncidentLink,
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
    sourceSlot: bridgeEvent.sourceSlot,
    eventType: bridgeEvent.eventType,
    sourceIncidentId: bridgeEvent.sourceIncidentId,
    sourcePayloadHash: hashPayload(bridgeEvent.rawPayload),
    timestamp: new Date().toISOString(),
    rcIncidentId: "UNRESOLVED",
  };
  let skipDefaultAudit = false;

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

    const sourceConfig = getCadSlotConfig(config, bridgeEvent.sourceSlot);
    if (!sourceConfig) {
      audit.outcome = "SKIPPED";
      audit.errorDetail = "source_slot_not_configured";
      return;
    }
    const adapter = getCadBridgeAdapter(sourceConfig.vendor);
    let canonicalChanges = adapter.toCanonical(bridgeEvent);

    let incident = await cadBridgeStore.getIncidentByVendorId(
      bridgeEvent.agencyId,
      bridgeEvent.sourceSlot,
      bridgeEvent.sourceIncidentId,
    );
    const isNewIncident = incident == null;

    if (!incident) {
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
        sourceSlot: bridgeEvent.sourceSlot,
        existingValue: incident.status,
        incomingValue: "CLOSED",
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

    if (!incident) {
      audit.outcome = "SKIPPED";
      return;
    }
    const resolved = incident;

    if (
      bridgeEvent.eventType === "UNIT_STATUS_CHANGED" &&
      canonicalChanges.units?.length &&
      !canonicalChanges.units.some((u) => resolved.units.some((existing) => existing.unitId === u.unitId))
    ) {
      audit.rcIncidentId = resolved.rcIncidentId;
      audit.outcome = "SKIPPED";
      audit.errorDetail = "Unit is not assigned to a shared incident";
      await cadBridgeStore.saveIncident(resolved);
      return;
    }

    if (
      bridgeEvent.eventType === "TRANSFER_REQUESTED" ||
      bridgeEvent.eventType === "TRANSFER_ACCEPTED" ||
      bridgeEvent.eventType === "TRANSFER_CANCELLED"
    ) {
      incident = applyTransferEvent(resolved, bridgeEvent, config);
    } else {
      incident = resolved;
    }

    audit.rcIncidentId = incident.rcIncidentId;
    const destinations = fanoutCadSlots(config, bridgeEvent.sourceSlot);
    if (destinations.length === 0) {
      await cadBridgeStore.saveIncident(incident);
      audit.outcome = "SKIPPED";
      audit.errorDetail = "no_outbound_participants";
      return;
    }

    let anyBuffered = false;
    let anyError = false;
    let anySuccess = false;
    skipDefaultAudit = true;

    for (const destinationSlot of destinations) {
      const destConfig = getCadSlotConfig(config, destinationSlot);
      if (!destConfig) continue;
      const destAdapter = getCadBridgeAdapter(destConfig.vendor);
      const destinationIncidentId = getIncidentLink(incident, destinationSlot)?.incidentId;
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
        incident = setIncidentLink(incident, destinationSlot, {
          incidentId: publishResult.createdIncidentId,
          vendor: destConfig.vendor,
          lastSyncedAt: new Date().toISOString(),
        });
      }

      if (publishResult.outcome === "SUCCESS") anySuccess = true;
      else if (publishResult.outcome === "BUFFERED") anyBuffered = true;
      else if (publishResult.outcome !== "SKIPPED") anyError = true;

      await cadBridgeStore.putAudit({
        agencyId: bridgeEvent.agencyId,
        eventId: `${bridgeEvent.eventId}:${destinationSlot}`,
        rcIncidentId: incident.rcIncidentId,
        direction: cadBridgeAuditDirection(bridgeEvent.sourceSlot, destinationSlot),
        sourceSlot: bridgeEvent.sourceSlot,
        destinationSlot,
        eventType: bridgeEvent.eventType,
        sourceIncidentId: bridgeEvent.sourceIncidentId,
        destinationIncidentId: publishResult.createdIncidentId ?? destinationIncidentId,
        sourcePayloadHash: audit.sourcePayloadHash ?? "",
        outboundPayloadHash: publishResult.outboundPayloadHash,
        outcome: publishResult.outcome,
        conflictIds: audit.conflictIds,
        errorCode: publishResult.errorCode,
        errorDetail: publishResult.errorDetail,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
    }

    if (anyError) incident = { ...incident, syncState: "ERROR" };
    else if (anyBuffered) incident = { ...incident, syncState: "BUFFERED" };
    else if (anySuccess) {
      incident = {
        ...incident,
        syncState: incident.pendingConflicts.length > 0 ? "CONFLICT" : "IN_SYNC",
      };
    }

    incident = { ...incident, updatedAt: new Date().toISOString() };
    await cadBridgeStore.saveIncident(incident);
    audit.outcome = anyError ? "FAILED" : anyBuffered ? "BUFFERED" : anySuccess ? "SUCCESS" : "SKIPPED";
  } catch (err) {
    skipDefaultAudit = false;
    audit.outcome = "FAILED";
    audit.errorDetail = "router_error";
    console.error("[cad-bridge.router] unhandled error", {
      agencyId: bridgeEvent.agencyId,
      eventId: bridgeEvent.eventId,
      message: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    if (skipDefaultAudit && audit.outcome !== "FAILED") return;
    await cadBridgeStore.putAudit({
      agencyId: audit.agencyId ?? bridgeEvent.agencyId,
      eventId: bridgeEvent.eventId,
      rcIncidentId: audit.rcIncidentId ?? "UNRESOLVED",
      direction: audit.direction ?? `${bridgeEvent.sourceSlot}_TO_HUB`,
      sourceSlot: bridgeEvent.sourceSlot,
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
  config: CADBridgeConfig,
  changes: Partial<CanonicalIncident>,
): CanonicalIncident {
  const now = new Date().toISOString();
  const sourceVendor = getCadSlotConfig(config, sourceSlot)?.vendor ?? config.cadA.vendor;
  const extraLinks =
    isCadBridgeExtraSlot(sourceSlot)
      ? {
          [sourceSlot]: {
            incidentId: sourceIncidentId,
            vendor: sourceVendor,
            lastSyncedAt: now,
          },
        }
      : undefined;
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
    extraLinks,
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
