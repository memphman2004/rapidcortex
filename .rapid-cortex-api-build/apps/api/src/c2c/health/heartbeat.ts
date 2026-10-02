import type { ICadAdapter } from "../cad-adapters/adapter.interface.js";
import type { AlertSink } from "./alerting.js";
import { ConsoleAlertSink } from "./alerting.js";
import { LatencyTracker } from "./latency.js";

export type HealthStatus = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  alertChannels: string[];
}

export interface AgencyHealthStatus {
  agencyId: string;
  status: HealthStatus;
  lastHeartbeatAt: string;
  latencyP50Ms: number;
  latencyP99Ms: number;
  missedHeartbeats: number;
  consecutiveMisses: number;
}

export interface SystemHealthSummary {
  status: HealthStatus;
  agencies: AgencyHealthStatus[];
  checkedAt: string;
}

type StatusHandler = (agencyId: string, status: HealthStatus) => void;

export class HeartbeatMonitor {
  private adapters = new Map<string, ICadAdapter>();
  private health = new Map<string, AgencyHealthStatus>();
  private latency = new Map<string, LatencyTracker>();
  private handlers: StatusHandler[] = [];

  constructor(
    private readonly config: HeartbeatConfig = { intervalMs: 30_000, timeoutMs: 90_000, alertChannels: ["SNS"] },
    private readonly alerts: AlertSink = new ConsoleAlertSink(),
  ) {}

  async startMonitoring(agencyId: string, adapter: ICadAdapter): Promise<void> {
    this.adapters.set(agencyId, adapter);
    this.latency.set(agencyId, new LatencyTracker());
    this.health.set(agencyId, {
      agencyId,
      status: "UNKNOWN",
      lastHeartbeatAt: new Date(0).toISOString(),
      latencyP50Ms: 0,
      latencyP99Ms: 0,
      missedHeartbeats: 0,
      consecutiveMisses: 0,
    });
  }

  async stopMonitoring(agencyId: string): Promise<void> {
    this.adapters.delete(agencyId);
  }

  onStatusChange(handler: StatusHandler): void {
    this.handlers.push(handler);
  }

  async pollOnce(): Promise<void> {
    for (const [agencyId, adapter] of this.adapters) {
      const started = Date.now();
      const current = this.health.get(agencyId);
      if (!current) continue;
      try {
        const result = await Promise.race([
          adapter.healthCheck(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), this.config.timeoutMs)),
        ]);
        const elapsed = Date.now() - started;
        this.latency.get(agencyId)?.record(elapsed);
        const nextStatus: HealthStatus = result.status === "ONLINE" ? "ONLINE" : result.status === "DEGRADED" ? "DEGRADED" : "OFFLINE";
        await this.applyStatus(agencyId, {
          ...current,
          status: nextStatus,
          lastHeartbeatAt: new Date().toISOString(),
          latencyP50Ms: this.latency.get(agencyId)?.p50 ?? elapsed,
          latencyP99Ms: this.latency.get(agencyId)?.p99 ?? elapsed,
          consecutiveMisses: 0,
        });
      } catch {
        const misses = current.consecutiveMisses + 1;
        await this.applyStatus(agencyId, {
          ...current,
          status: misses >= 3 ? "OFFLINE" : "DEGRADED",
          missedHeartbeats: current.missedHeartbeats + 1,
          consecutiveMisses: misses,
          latencyP50Ms: this.latency.get(agencyId)?.p50 ?? 0,
          latencyP99Ms: this.latency.get(agencyId)?.p99 ?? 0,
        });
      }
    }
  }

  async getAgencyHealth(agencyId: string): Promise<AgencyHealthStatus> {
    return (
      this.health.get(agencyId) ?? {
        agencyId,
        status: "UNKNOWN",
        lastHeartbeatAt: new Date(0).toISOString(),
        latencyP50Ms: 0,
        latencyP99Ms: 0,
        missedHeartbeats: 0,
        consecutiveMisses: 0,
      }
    );
  }

  async getSystemHealth(): Promise<SystemHealthSummary> {
    const agencies = [...this.health.values()];
    const offline = agencies.some((a) => a.status === "OFFLINE");
    const degraded = agencies.some((a) => a.status === "DEGRADED");
    return {
      status: offline ? "OFFLINE" : degraded ? "DEGRADED" : agencies.length ? "ONLINE" : "UNKNOWN",
      agencies,
      checkedAt: new Date().toISOString(),
    };
  }

  private async applyStatus(agencyId: string, next: AgencyHealthStatus): Promise<void> {
    const prev = this.health.get(agencyId);
    this.health.set(agencyId, next);
    if (prev && prev.status !== next.status) {
      for (const handler of this.handlers) handler(agencyId, next.status);
      if (next.status === "OFFLINE" || next.status === "ONLINE") {
        await this.alerts.notify(agencyId, next.status, `C2C agency ${agencyId} is ${next.status}`);
      }
    }
  }
}
