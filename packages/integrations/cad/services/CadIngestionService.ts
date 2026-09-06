import { CadAdapterRegistry } from "../adapters/CadAdapterRegistry.js";
import { cadConnectorService } from "./CadConnectorService.js";
import { cadConnectorAuditStore } from "./CadConnectorAuditStore.js";
import { cadUnifiedIncidentStore } from "./CadUnifiedIncidentStore.js";
import type { CadConnectorConfig, UnifiedCadIncident } from "rapid-cortex-shared";

export type CadIngestionRunResult = {
  connectorId: string;
  agencyId: string;
  rawCount: number;
  normalizedCount: number;
  inserted: number;
  exactDuplicates: number;
  crossDuplicates: number;
  errors: number;
};

function dueForPoll(config: CadConnectorConfig, nowMs: number): boolean {
  const interval = Math.max(30, config.pollingIntervalSeconds ?? 60) * 1000;
  const last = (config as CadConnectorConfig & { lastSyncAt?: string }).lastSyncAt
    ? Date.parse((config as CadConnectorConfig & { lastSyncAt?: string }).lastSyncAt ?? "")
    : 0;
  if (!Number.isFinite(last) || last <= 0) return true;
  return nowMs - last >= interval;
}

/**
 * Orchestrates polling: fetch → normalize → dedupe → persist → audit.
 */
export class CadIngestionService {
  async ingestConnector(config: CadConnectorConfig, actorId = "system:cad-ingest"): Promise<CadIngestionRunResult> {
    const adapter = CadAdapterRegistry.resolve(config.vendorId);
    const credentials = await cadConnectorService.resolveCredentials(config);
    const fetched = await adapter.fetchIncidents({
      config,
      credentials,
      sinceTimestamp: (config as CadConnectorConfig & { lastSyncAt?: string }).lastSyncAt,
      limit: 100,
    });
    let inserted = 0;
    let exactDuplicates = 0;
    let crossDuplicates = 0;
    for (const incident of fetched.incidents) {
      const decision = await cadUnifiedIncidentStore.evaluateDedup(incident);
      if (decision.action === "skip_exact_duplicate") {
        exactDuplicates += 1;
        continue;
      }
      if (decision.action === "mark_cross_connector_duplicate") {
        const dup: UnifiedCadIncident = {
          ...incident,
          isDuplicate: true,
          canonicalUnifiedId: decision.canonicalUnifiedId,
          status: "duplicate",
        };
        await cadUnifiedIncidentStore.put(dup);
        crossDuplicates += 1;
        await cadConnectorAuditStore.append({
          agencyId: config.agencyId,
          actorId,
          type: "cad.ingestion.deduplicated",
          connectorId: config.connectorId,
          detail: {
            unifiedId: dup.unifiedId,
            canonicalUnifiedId: decision.canonicalUnifiedId,
          },
        });
        continue;
      }
      await cadUnifiedIncidentStore.put(decision.incident);
      inserted += 1;
    }
    await cadConnectorService.touchLastSync(config.agencyId, config.connectorId, fetched.fetchedAt);
    const result: CadIngestionRunResult = {
      connectorId: config.connectorId,
      agencyId: config.agencyId,
      rawCount: fetched.rawCount,
      normalizedCount: fetched.normalizedCount,
      inserted,
      exactDuplicates,
      crossDuplicates,
      errors: fetched.errors.length,
    };
    await cadConnectorAuditStore.append({
      agencyId: config.agencyId,
      actorId,
      type: "cad.ingestion.run",
      connectorId: config.connectorId,
      detail: { ...result, fieldErrors: fetched.errors.slice(0, 20) },
    });
    return result;
  }

  async pollDueConnectors(): Promise<CadIngestionRunResult[]> {
    const now = Date.now();
    const connectors = await cadConnectorService.listEnabledPollingConnectors();
    const due = connectors.filter((c) => dueForPoll(c, now));
    const results: CadIngestionRunResult[] = [];
    for (const connector of due) {
      try {
        results.push(await this.ingestConnector(connector));
      } catch (err) {
        await cadConnectorAuditStore.append({
          agencyId: connector.agencyId,
          actorId: "system:cad-ingest",
          type: "cad.ingestion.run",
          connectorId: connector.connectorId,
          detail: { error: err instanceof Error ? err.message : "ingest failed" },
        });
      }
    }
    return results;
  }
}

export const cadIngestionService = new CadIngestionService();
