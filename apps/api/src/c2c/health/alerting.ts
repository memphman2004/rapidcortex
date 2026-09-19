export type AlertChannel = "SNS" | "EMAIL" | "WEBSOCKET";

export interface AlertSink {
  notify(agencyId: string, status: string, message: string): Promise<void>;
}

export class ConsoleAlertSink implements AlertSink {
  async notify(agencyId: string, status: string, message: string): Promise<void> {
    console.warn(JSON.stringify({ type: "c2c.health.alert", agencyId, status, message }));
  }
}
