import type { TimelineEvent, TimelineEventKind, TimelineEventSource } from "rapid-cortex-shared";
import { IncidentTimelineRepository } from "../repositories/incidentTimelineRepository.js";
import { env } from "../lib/env.js";
import { makeId } from "./ids.js";

export type TimelineEmitInput = {
  incidentId: string;
  agencyId: string;
  kind: TimelineEventKind;
  source: TimelineEventSource;
  actorId?: string;
  actorRole?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
};

/** Append-only incident timeline sink — mirrors {@link AuditLogger} usage in API handlers. */
export class IncidentTimelineLogger {
  constructor(private readonly repo = new IncidentTimelineRepository()) {}

  isEnabled(): boolean {
    return Boolean(env.incidentTimelineTable);
  }

  async emit(input: TimelineEmitInput): Promise<TimelineEvent | null> {
    if (!this.isEnabled()) return null;
    const event: TimelineEvent = {
      eventId: makeId("tl"),
      incidentId: input.incidentId,
      agencyId: input.agencyId,
      kind: input.kind,
      source: input.source,
      actorId: input.actorId,
      actorRole: input.actorRole,
      payload: input.payload ?? {},
      timestamp: input.timestamp ?? new Date().toISOString(),
    };
    await this.repo.put(event);
    return event;
  }
}

export const incidentTimelineLogger = new IncidentTimelineLogger();
