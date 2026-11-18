import type {
  DemoAgencyState,
  DemoCall,
  DemoEvent,
  DemoIncident,
  DemoTranscriptLine,
  DemoUnitStatus,
} from "../types";

export class DemoStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoStateError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireString(payload: DemoEvent["payload"], key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new DemoStateError(`Event payload is missing ${key}`);
  }
  return value;
}

function updateIncident(
  state: DemoAgencyState,
  incidentId: string,
  updater: (incident: DemoIncident) => DemoIncident,
): DemoAgencyState {
  const index = state.activeIncidents.findIndex((incident) => incident.id === incidentId);
  if (index < 0) return state;
  const next = state.activeIncidents.slice();
  const current = next[index];
  if (!current) return state;
  next[index] = updater(current);
  return { ...state, activeIncidents: next };
}

function updateCall(
  state: DemoAgencyState,
  callId: string,
  updater: (call: DemoCall) => DemoCall,
): DemoAgencyState {
  const index = state.callQueue.findIndex((call) => call.id === callId);
  if (index < 0) return state;
  const next = state.callQueue.slice();
  const current = next[index];
  if (!current) return state;
  next[index] = updater(current);
  return { ...state, callQueue: next };
}

function queuedDepth(calls: DemoCall[]): number {
  return calls.filter((call) => call.status === "queued").length;
}

export function applyDemoEvent(state: DemoAgencyState, event: DemoEvent): DemoAgencyState {
  const next = clone(state);
  const { payload } = event;

  switch (event.type) {
    case "CALL_RECEIVED": {
      const incoming = payload.call as DemoCall;
      next.callQueue = [...next.callQueue, clone(incoming)];
      next.metrics = { ...next.metrics, queueDepth: queuedDepth(next.callQueue) };
      return next;
    }
    case "CALL_ANSWERED": {
      const callId = requireString(payload, "callId");
      const positionId = requireString(payload, "positionId");
      const updated = updateCall(next, callId, (call) => ({
        ...call,
        status: "active",
        positionId,
      }));
      updated.metrics = {
        ...updated.metrics,
        callsAnswered: updated.metrics.callsAnswered + 1,
        queueDepth: queuedDepth(updated.callQueue),
      };
      return updated;
    }
    case "INCIDENT_CREATED": {
      const incident = clone(payload.incident as DemoIncident);
      next.activeIncidents = [...next.activeIncidents, incident];
      return next;
    }
    case "INCIDENT_UPDATED": {
      const incidentId = requireString(payload, "incidentId");
      const patch = (payload.patch ?? {}) as Partial<DemoIncident>;
      return updateIncident(next, incidentId, (incident) => ({ ...incident, ...patch }));
    }
    case "INCIDENT_CLOSED": {
      const incidentId = requireString(payload, "incidentId");
      const incident = next.activeIncidents.find((item) => item.id === incidentId);
      if (!incident) return next;
      const closed: DemoIncident = { ...incident, status: "closed" };
      next.activeIncidents = next.activeIncidents.filter((item) => item.id !== incidentId);
      next.closedIncidents = [...next.closedIncidents, closed];
      next.units = next.units.map((unit) =>
        unit.incidentId === incidentId ? { ...unit, status: "available", incidentId: undefined } : unit,
      );
      return next;
    }
    case "UNIT_DISPATCHED": {
      const unitId = requireString(payload, "unitId");
      const incidentId = requireString(payload, "incidentId");
      const unit = next.units.find((item) => item.id === unitId);
      const incident = next.activeIncidents.find((item) => item.id === incidentId);
      if (!unit) throw new DemoStateError(`Unknown unit ${unitId}`);
      if (!incident) throw new DemoStateError(`${unitId} dispatched before incident ${incidentId} existed`);
      if (unit.status !== "available" && unit.status !== "cleared") {
        throw new DemoStateError(`${unitId} cannot be dispatched while ${unit.status}`);
      }
      next.units = next.units.map((item) =>
        item.id === unitId ? { ...item, status: "dispatched", incidentId } : item,
      );
      return updateIncident(next, incidentId, (current) => ({
        ...current,
        units: current.units.includes(unitId) ? current.units : [...current.units, unitId],
      }));
    }
    case "UNIT_STATUS_CHANGED": {
      const unitId = requireString(payload, "unitId");
      const status = requireString(payload, "status") as DemoUnitStatus;
      const unit = next.units.find((item) => item.id === unitId);
      if (!unit) throw new DemoStateError(`Unknown unit ${unitId}`);
      if (status === "available" || status === "cleared") {
        const incidentId = unit.incidentId;
        next.units = next.units.map((item) =>
          item.id === unitId ? { ...item, status: "available", incidentId: undefined } : item,
        );
        if (!incidentId) return next;
        return updateIncident(next, incidentId, (incident) => ({
          ...incident,
          units: incident.units.filter((id) => id !== unitId),
        }));
      }
      if (!unit.incidentId) {
        throw new DemoStateError(`${unitId} moved to ${status} before it was dispatched`);
      }
      const incidentId = typeof payload.incidentId === "string" ? payload.incidentId : unit.incidentId;
      if (incidentId !== unit.incidentId) {
        throw new DemoStateError(`${unitId} status change names a different incident than its dispatch`);
      }
      next.units = next.units.map((item) => (item.id === unitId ? { ...item, status, incidentId } : item));
      return next;
    }
    case "CALL_ASSIST_SUGGESTION": {
      const text = requireString(payload, "text");
      const incidentId = typeof payload.incidentId === "string" ? payload.incidentId : "";
      const callId = typeof payload.callId === "string" ? payload.callId : "";
      let updated = next;
      if (incidentId) {
        updated = updateIncident(updated, incidentId, (incident) => ({ ...incident, callAssist: text }));
      }
      if (callId) {
        updated = updateCall(updated, callId, (call) => ({ ...call, callAssist: text }));
      }
      return updated;
    }
    case "TRANSCRIPTION_UPDATE": {
      const incidentId = requireString(payload, "incidentId");
      const line: DemoTranscriptLine = {
        speaker: requireString(payload, "speaker") as DemoTranscriptLine["speaker"],
        text: requireString(payload, "text"),
        offsetSeconds: event.relativeOffsetSeconds,
      };
      return updateIncident(next, incidentId, (incident) => ({
        ...incident,
        transcript: [...incident.transcript, line],
      }));
    }
    case "TRANSLATION_DETECTED": {
      const language = requireString(payload, "language");
      const note = requireString(payload, "note");
      const callId = typeof payload.callId === "string" ? payload.callId : "";
      const incidentId = typeof payload.incidentId === "string" ? payload.incidentId : "";
      let updated = callId
        ? updateCall(next, callId, (call) => ({ ...call, language }))
        : next;
      if (incidentId && updated.activeIncidents.some((incident) => incident.id === incidentId)) {
        updated = updateIncident(updated, incidentId, (incident) => ({
          ...incident,
          translation: { language, note },
        }));
      }
      return updated;
    }
    case "CONTINUITY_LOG_UPDATED": {
      const incidentId = requireString(payload, "incidentId");
      const entry = requireString(payload, "entry");
      const commandNote = typeof payload.commandNote === "string" ? payload.commandNote : "";
      return updateIncident(next, incidentId, (incident) => ({
        ...incident,
        continuity: [...incident.continuity, entry],
        commandNotes: commandNote ? [...incident.commandNotes, commandNote] : incident.commandNotes,
      }));
    }
    case "SUPERVISOR_ALERT": {
      const message = requireString(payload, "message");
      next.alerts = [...next.alerts, { id: event.id, message, offsetSeconds: event.relativeOffsetSeconds }];
      if (typeof payload.shiftSummary === "string") next.shiftSummary = payload.shiftSummary;
      if (typeof payload.coverageGap === "boolean") next.coverageGap = payload.coverageGap;
      return next;
    }
    case "QUEUE_DEPTH_CHANGED": {
      const depth = payload.depth;
      if (typeof depth !== "number") throw new DemoStateError("Queue depth must be a number");
      next.metrics = { ...next.metrics, queueDepth: depth };
      return next;
    }
    case "REPEAT_CALLER_FLAGGED": {
      const callId = requireString(payload, "callId");
      return updateCall(next, callId, (call) => ({ ...call, repeatCaller: true }));
    }
    case "MUTUAL_AID_REQUESTED": {
      const resource = requireString(payload, "resource");
      const note = typeof payload.note === "string" ? payload.note : resource;
      next.mutualAid = [...next.mutualAid, note];
      return next;
    }
    case "ADMIN_CALL_ROUTED": {
      const routed = clone(payload.call as DemoCall);
      next.callQueue = [...next.callQueue, routed];
      next.metrics = {
        ...next.metrics,
        adminRouted: next.metrics.adminRouted + 1,
        queueDepth: queuedDepth(next.callQueue),
      };
      next.recentActivity = [
        ...next.recentActivity,
        typeof payload.disposition === "string" ? payload.disposition : routed.summary,
      ];
      return next;
    }
    default:
      return next;
  }
}

export function projectState(starting: DemoAgencyState, events: readonly DemoEvent[], offsetSeconds: number): DemoAgencyState {
  return events
    .filter((item) => item.relativeOffsetSeconds <= offsetSeconds)
    .reduce((state, item) => applyDemoEvent(state, item), clone(starting));
}
