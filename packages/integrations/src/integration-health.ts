export type IntegrationConnectorId =
  | "api"
  | "audio"
  | "transcript_stream"
  | "cad"
  | "event_feed"
  | "webhook"
  | "telephony";

export type ConnectorHealth = "up" | "degraded" | "down" | "unknown" | "planned";

export type ConnectorHealthSnapshot = {
  connectorId: IntegrationConnectorId;
  label: string;
  health: ConnectorHealth;
  detail?: string;
  checkedAt: string;
};

/** Aggregate health for dashboards and compliance surfaces — not vendor SDKs. */
export interface IntegrationHealthAdapter {
  readonly adapterId: string;
  getSnapshot(): Promise<ConnectorHealthSnapshot[]>;
  subscribe(handler: (snapshots: ConnectorHealthSnapshot[]) => void): () => void;
}
