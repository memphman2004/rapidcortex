import type { IntegrationDomainEvent } from "./normalized-events.js";

/** Subscribe to normalized integration / domain events for an incident or agency feed. */
export interface IncidentEventFeedAdapter {
  readonly adapterId: string;
  subscribe(
    scope: { incidentId?: string; agencyId?: string },
    handler: (event: IntegrationDomainEvent) => void,
  ): () => void;
}
