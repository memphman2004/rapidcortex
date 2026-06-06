import type { TranscriptSegment } from "rapid-cortex-shared";
import type { AudioConnectionState, AudioInputAdapter } from "./audio-adapter.js";
import type { CadAdapter, CadCallerCardContext } from "./cad-adapter.js";
import type { IncidentEventFeedAdapter } from "./incident-event-adapter.js";
import type { IntegrationDomainEvent } from "./normalized-events.js";
import type {
  ConnectorHealthSnapshot,
  IntegrationHealthAdapter,
} from "./integration-health.js";

export class MockAudioInputAdapter implements AudioInputAdapter {
  readonly adapterId = "mock-audio";

  async startStream(_incidentId: string): Promise<void> {}

  async stopStream(): Promise<void> {}

  onTranscriptChunk(_handler: (chunk: Partial<TranscriptSegment>) => void): () => void {
    return () => {};
  }

  onConnectionStatus(handler: (state: AudioConnectionState, detail?: string) => void): () => void {
    handler("connected", "mock");
    return () => {};
  }
}

export class MockCadAdapter implements CadAdapter {
  readonly adapterId = "mock-cad";

  async getIncidentContext(externalCadId: string): Promise<Record<string, unknown>> {
    return { externalCadId, mock: true, units: [] };
  }

  async pushSummary(_payload: { externalCadId: string; summary: string }): Promise<void> {}

  async getCallerData(ctx: CadCallerCardContext): Promise<Record<string, unknown>> {
    const line = ctx.callerAddressLine?.trim();
    return {
      cadStatus: "mock",
      callerName: line ? "Mock CAD subscriber" : null,
      callbackPhone: "+15555550100",
      emergencyContacts: [],
      premiseWarnings: line ? ["Mock: verify structure fire access on file."] : [],
      deviceData: { mockHandset: true, network: "mock-lte" },
      premiseRisk: "low",
      historyFlags: [] as string[],
      suggestedPremiseNote: line
        ? `Mock CAD: premise linked to “${String(line).slice(0, 80)}”.`
        : "Mock CAD: no premise note on file.",
      normalizedAddressEcho: ctx.normalizedAddress ?? null,
    };
  }
}

export class MockIncidentEventFeedAdapter implements IncidentEventFeedAdapter {
  readonly adapterId = "mock-event-feed";
  private readonly subs = new Set<(e: IntegrationDomainEvent) => void>();

  subscribe(
    _scope: { incidentId?: string; agencyId?: string },
    handler: (event: IntegrationDomainEvent) => void,
  ): () => void {
    this.subs.add(handler);
    return () => {
      this.subs.delete(handler);
    };
  }

  emitDemo(event: IntegrationDomainEvent): void {
    for (const h of this.subs) h(event);
  }
}

export class MockIntegrationHealthAdapter implements IntegrationHealthAdapter {
  readonly adapterId = "mock-integration-health";

  async getSnapshot(): Promise<ConnectorHealthSnapshot[]> {
    const at = new Date().toISOString();
    return [
      { connectorId: "api", label: "Rapid Cortex API", health: "up", checkedAt: at },
      { connectorId: "audio", label: "Audio ingest", health: "planned", checkedAt: at },
      { connectorId: "transcript_stream", label: "Live transcript", health: "planned", checkedAt: at },
      { connectorId: "cad", label: "CAD / RMS", health: "planned", checkedAt: at },
      { connectorId: "event_feed", label: "Event feed", health: "up", detail: "mock", checkedAt: at },
    ];
  }

  subscribe(_handler: (snapshots: ConnectorHealthSnapshot[]) => void): () => void {
    return () => {};
  }
}
