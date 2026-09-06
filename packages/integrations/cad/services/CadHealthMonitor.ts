import type { CadHealthCheckResult } from "rapid-cortex-shared";
import { CadAdapterRegistry } from "../adapters/CadAdapterRegistry.js";
import { cadConnectorService } from "./CadConnectorService.js";
import { cadConnectorAuditStore } from "./CadConnectorAuditStore.js";

export type CadHealthSweepResult = {
  checks: CadHealthCheckResult[];
  changed: Array<{ connectorId: string; agencyId: string; from?: string; to: string }>;
};

function metricValue(status: CadHealthCheckResult["status"]): number {
  if (status === "healthy") return 0;
  if (status === "degraded" || status === "auth_failure") return 1;
  return 2;
}

/**
 * Runs healthCheck() on each enabled connector. Callers emit CloudWatch/SNS.
 */
export class CadHealthMonitor {
  async sweep(): Promise<CadHealthSweepResult> {
    const connectors = await cadConnectorService.listEnabledConnectors();
    const checks: CadHealthCheckResult[] = [];
    const changed: CadHealthSweepResult["changed"] = [];
    for (const config of connectors) {
      const adapter = CadAdapterRegistry.resolve(config.vendorId);
      const credentials = await cadConnectorService.resolveCredentials(config);
      const previous = config.lastHealthCheck?.status;
      const result = await adapter.healthCheck({ config, credentials });
      await cadConnectorService.updateHealth(config.agencyId, config.connectorId, result);
      checks.push(result);
      console.info(
        JSON.stringify({
          metric: "RapidCortex/CadConnector/HealthStatus",
          connectorId: config.connectorId,
          agencyId: config.agencyId,
          value: metricValue(result.status),
          status: result.status,
        }),
      );
      if (previous && previous !== result.status) {
        changed.push({
          connectorId: config.connectorId,
          agencyId: config.agencyId,
          from: previous,
          to: result.status,
        });
      }
      await cadConnectorAuditStore.append({
        agencyId: config.agencyId,
        actorId: "system:cad-health",
        type: "cad.connector.health_check",
        connectorId: config.connectorId,
        detail: { status: result.status, latencyMs: result.latencyMs, message: result.message },
      });
    }
    return { checks, changed };
  }
}

export const cadHealthMonitor = new CadHealthMonitor();
