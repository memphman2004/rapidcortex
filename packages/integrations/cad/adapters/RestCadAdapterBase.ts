import { randomUUID } from "node:crypto";
import type {
  CadConnectorConfig,
  CadFieldMapping,
  CadHealthCheckResult,
  CadVendorId,
  CadWriteBackRequest,
  UnifiedCadIncident,
  UnifiedCadStatus,
  UnifiedCadUnit,
} from "rapid-cortex-shared";
import type {
  CadAdapter,
  CadAdapterFetchResult,
  CadAdapterWriteBackResult,
  ResolvedCadCredentials,
} from "../adapter/CadAdapter.js";
import { CadAdapterTranslationError } from "../adapter/CadAdapter.js";
import { CadDeduplicationEngine } from "../services/CadDeduplicationEngine.js";
import { CadFieldMappingEngine } from "../services/CadFieldMappingEngine.js";
import { isCadConnectorMock } from "../env.js";
import { defaultMappingsForVendor } from "./default-mappings.js";
import { cadHttpRequest, extractIncidentRows, xmlToRecord } from "./rest-http.js";

function asPriority(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(value);
  if (n >= 1 && n <= 5) return n as 1 | 2 | 3 | 4 | 5;
  return 3;
}

function asStatus(value: unknown): UnifiedCadStatus {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const statuses: readonly string[] = [
    "pending",
    "queued",
    "dispatched",
    "en_route",
    "on_scene",
    "cleared",
    "cancelled",
    "duplicate",
    "unknown",
  ];
  if (statuses.includes(raw)) return raw as UnifiedCadStatus;
  return "unknown";
}

function asUnits(raw: Record<string, unknown>): UnifiedCadUnit[] {
  const source = raw.Units ?? raw.units ?? raw.UnitList;
  if (!Array.isArray(source)) return [];
  return source
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row, index) => ({
      unitId: String(row.unitId ?? row.UnitId ?? row.id ?? `u${index}`),
      callSign: String(row.callSign ?? row.CallSign ?? row.unitId ?? row.UnitId ?? `UNIT-${index}`),
      status: String(row.status ?? row.Status ?? "unknown"),
    }));
}

export abstract class RestCadAdapterBase implements CadAdapter {
  abstract readonly vendorId: CadVendorId;
  abstract incidentsPath(): string;
  abstract healthPath(): string;
  abstract writeBackPath(vendorIncidentId: string): string;

  defaultMappings(): CadFieldMapping[] {
    return defaultMappingsForVendor(this.vendorId);
  }

  sampleVendorPayloads(): Record<string, unknown>[] {
    return [];
  }

  mappingsFor(config: CadConnectorConfig): CadFieldMapping[] {
    return config.fieldMappings.length > 0 ? config.fieldMappings : this.defaultMappings();
  }

  normalize(raw: Record<string, unknown>, config: CadConnectorConfig): UnifiedCadIncident {
    const { result } = CadFieldMappingEngine.applyInbound(raw, this.mappingsFor(config));
    const now = new Date().toISOString();
    const vendorIncidentId = String(result.vendorIncidentId ?? raw.EventNumber ?? raw.inc_nbr ?? raw.CallId ?? "");
    const incident: UnifiedCadIncident = {
      unifiedId: `ucad_${randomUUID()}`,
      agencyId: config.agencyId,
      connectorId: config.connectorId,
      vendorId: this.vendorId,
      department: config.department,
      vendorIncidentId,
      vendorCallId: result.vendorCallId,
      cadIncidentNumber: result.cadIncidentNumber ?? vendorIncidentId,
      incidentType: String(result.incidentType ?? "UNKNOWN"),
      priority: asPriority(result.priority),
      status: asStatus(result.status),
      nature: result.nature,
      address: result.address,
      addressVerified: result.addressVerified,
      latitude: typeof result.latitude === "number" ? result.latitude : Number(result.latitude) || undefined,
      longitude: typeof result.longitude === "number" ? result.longitude : Number(result.longitude) || undefined,
      zone: result.zone,
      beatOrDistrict: result.beatOrDistrict,
      callerName: result.callerName,
      callerPhone: result.callerPhone,
      callerCallbackPhone: result.callerCallbackPhone,
      units: result.units?.length ? result.units : asUnits(raw),
      callReceivedAt: result.callReceivedAt,
      dispatchedAt: result.dispatchedAt,
      enRouteAt: result.enRouteAt,
      arrivedAt: result.arrivedAt,
      clearedAt: result.clearedAt,
      dedupeKey: "",
      isDuplicate: false,
      rawVendorPayload: raw,
      ingestedAt: now,
      lastSyncAt: now,
      schemaVersion: 1,
    };
    incident.dedupeKey = CadDeduplicationEngine.buildDedupeKey(incident);
    return incident;
  }

  translateWriteBack(writeBack: CadWriteBackRequest, config: CadConnectorConfig): Record<string, unknown> {
    const { result, errors } = CadFieldMappingEngine.applyOutbound(writeBack.payload, this.mappingsFor(config));
    const requiredMissing = errors.filter((e) => e.message.includes("Required"));
    if (requiredMissing[0]) {
      throw new CadAdapterTranslationError(requiredMissing[0].message, requiredMissing[0].field, this.vendorId);
    }
    return {
      ...result,
      action: writeBack.payload.action,
      narrative: writeBack.payload.narrative,
    };
  }

  async fetchIncidents(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
    sinceTimestamp?: string;
    limit?: number;
  }): Promise<CadAdapterFetchResult> {
    const fetchedAt = new Date().toISOString();
    const rawRows = isCadConnectorMock()
      ? this.sampleVendorPayloads()
      : await this.fetchRawRows(params);
    const errors = [];
    const incidents: UnifiedCadIncident[] = [];
    for (const raw of rawRows) {
      const mapped = CadFieldMappingEngine.applyInbound(raw, this.mappingsFor(params.config));
      errors.push(...mapped.errors);
      const incident = this.normalize(raw, params.config);
      if (!incident.vendorIncidentId) {
        errors.push({ field: "vendorIncidentId", message: "Missing vendor incident id after normalize" });
        continue;
      }
      incidents.push(incident);
    }
    const sliced = incidents.slice(0, params.limit ?? incidents.length);
    return {
      incidents: sliced,
      fetchedAt,
      rawCount: rawRows.length,
      normalizedCount: sliced.length,
      errors,
    };
  }

  async submitWriteBack(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
    writeBack: CadWriteBackRequest;
  }): Promise<CadAdapterWriteBackResult> {
    const payload = this.translateWriteBack(params.writeBack, params.config);
    if (isCadConnectorMock()) {
      return { success: true, vendorResponseCode: 200, vendorResponseBody: JSON.stringify({ mock: true, payload }) };
    }
    const vendorIncidentId = String(payload.EventNumber ?? payload.inc_nbr ?? payload.CallId ?? payload.call_number ?? payload.callId ?? "");
    try {
      const res = await cadHttpRequest({
        baseUrl: params.config.baseUrl ?? "",
        path: this.writeBackPath(vendorIncidentId),
        method: "POST",
        credentials: params.credentials,
        body: payload,
        timeoutMs: 15_000,
      });
      return {
        success: true,
        vendorResponseCode: res.status,
        vendorResponseBody: res.text.slice(0, 2000),
      };
    } catch (err) {
      return {
        success: false,
        vendorResponseCode: err instanceof Error && "status" in err ? Number((err as { status?: number }).status) : undefined,
        errorMessage: err instanceof Error ? err.message : "Write-back failed",
      };
    }
  }

  async healthCheck(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
  }): Promise<CadHealthCheckResult> {
    const checkedAt = new Date().toISOString();
    if (isCadConnectorMock()) {
      return { connectorId: params.config.connectorId, status: "healthy", latencyMs: 1, checkedAt, message: "mock" };
    }
    const started = Date.now();
    try {
      await cadHttpRequest({
        baseUrl: params.config.baseUrl ?? "",
        path: this.healthPath(),
        credentials: params.credentials,
        timeoutMs: 5_000,
      });
      return {
        connectorId: params.config.connectorId,
        status: "healthy",
        latencyMs: Date.now() - started,
        checkedAt,
      };
    } catch (err) {
      const statusCode = err instanceof Error && "status" in err ? Number((err as { status?: number }).status) : undefined;
      const status =
        statusCode === 401 || statusCode === 403
          ? "auth_failure"
          : Date.now() - started >= 5000
            ? "unreachable"
            : "degraded";
      return {
        connectorId: params.config.connectorId,
        status,
        latencyMs: Date.now() - started,
        checkedAt,
        message: err instanceof Error ? err.message : "health check failed",
      };
    }
  }

  protected async fetchRawRows(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
    sinceTimestamp?: string;
    limit?: number;
  }): Promise<Record<string, unknown>[]> {
    const res = await cadHttpRequest({
      baseUrl: params.config.baseUrl ?? "",
      path: this.incidentsPath(),
      credentials: params.credentials,
      query: {
        LastUpdateTime: params.sinceTimestamp,
        since: params.sinceTimestamp,
        limit: params.limit != null ? String(params.limit) : undefined,
      },
      timeoutMs: 15_000,
    });
    if (typeof res.json === "string" && res.json.includes("<")) {
      return [xmlToRecord(res.json)];
    }
    return extractIncidentRows(res.json);
  }
}
