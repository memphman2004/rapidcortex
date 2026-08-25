/**
 * Core types and utilities for multi-vendor CAD API poll adapters.
 */

import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { CadVendor } from "rapid-cortex-shared";

export type PollCadVendor = Exclude<CadVendor, "console_one">;

export type CadIntegrationStatus =
  | "active"
  | "testing"
  | "inactive"
  | "error"
  | "auth_error";

export type AuthType = "bearer" | "api_key_header" | "basic" | "no_auth";

export interface CadIntegrationConfig {
  apiUrl?: string;
  authType?: AuthType;
  apiKey?: string;
  apiKeySecretArn?: string;
  apiKeyHeader?: string;
  agencyCode?: string;
  pollIntervalMinutes?: number;
  fieldMapping?: Record<string, string>;
  priorityMapping?: Record<string, string>;
  uiFieldMappings?: Array<{ sourceKey: string; targetId: string }>;
  /** Agency CAD nature → Rapid Cortex type/SOP mapping (read by ingest, not the poller). */
  natureCodeMappings?: unknown;
}

export interface RawCadIncident {
  cadEventId: string;
  incidentNumber?: string;
  incidentType?: string;
  priority?: string;
  rcPriority?: "P1" | "P2" | "P3" | "P4";
  location?: string;
  latitude?: number;
  longitude?: number;
  callerName?: string;
  callerPhone?: string;
  narrative?: string;
  units?: string;
  status?: string;
  responseCode?: string;
  agencyCode?: string;
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

export type PollResult =
  | {
      ok: true;
      incidents: RawCadIncident[];
      latencyMs: number;
      nextSince?: string;
      httpStatus: number;
    }
  | {
      ok: false;
      errorType: "auth_error" | "network_error" | "parse_error" | "empty_response" | "rate_limited";
      message: string;
      latencyMs: number;
      httpStatus?: number;
    };

export interface CadPollAdapter {
  vendor: PollCadVendor;
  poll(config: ResolvedCadConfig, sinceIso: string): Promise<PollResult>;
}

export interface ResolvedCadConfig {
  apiUrl: string;
  authType: AuthType;
  apiKey: string;
  apiKeyHeader: string;
  agencyCode: string;
  /** RC destination field id → vendor source path */
  fieldMapping: Record<string, string>;
  priorityMapping: Record<string, string>;
}

export type CircuitBreakerState =
  | { state: "CLOSED"; failureCount: number }
  | { state: "OPEN"; failureCount: number; openedAt: string; cooldownUntil: string }
  | { state: "HALF_OPEN"; failureCount: number; openedAt: string };

export type PollHistoryPoint = {
  ts: string;
  ok: boolean;
  incidentCount: number;
  latencyMs: number;
};

const smClient = new SecretsManagerClient({});
const secretCache = new Map<string, { value: string; fetchedAt: number }>();
const SECRET_CACHE_TTL_MS = 5 * 60 * 1000;

const PARSER_TO_RC_DEST: Record<string, string> = {
  cadNumber: "cadEventId",
  incidentNumber: "incidentNumber",
  incidentType: "incidentType",
  priority: "priority",
  location: "location",
  latitude: "latitude",
  longitude: "longitude",
  callerName: "callerName",
  callerCallback: "callerPhone",
  notes: "narrative",
  units: "units",
  status: "status",
  responseCode: "responseCode",
  agencyCode: "agencyCode",
};

function normalizeDestToSource(config: CadIntegrationConfig): Record<string, string> {
  const destToSource: Record<string, string> = {};

  if (Array.isArray(config.uiFieldMappings)) {
    for (const row of config.uiFieldMappings) {
      if (row.sourceKey && row.targetId) destToSource[row.targetId] = row.sourceKey;
    }
    return destToSource;
  }

  const fm = config.fieldMapping ?? {};
  for (const [key, value] of Object.entries(fm)) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (PARSER_TO_RC_DEST[key]) {
      destToSource[PARSER_TO_RC_DEST[key]!] = value;
    } else {
      destToSource[key] = value;
    }
  }
  return destToSource;
}

async function resolveSecret(arn: string): Promise<string> {
  const cached = secretCache.get(arn);
  if (cached && Date.now() - cached.fetchedAt < SECRET_CACHE_TTL_MS) return cached.value;
  const resp = await smClient.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = resp.SecretString ?? "";
  secretCache.set(arn, { value, fetchedAt: Date.now() });
  return value;
}

export async function resolveConfig(config: CadIntegrationConfig): Promise<ResolvedCadConfig> {
  if (!config.apiUrl?.trim()) {
    throw new Error("CadIntegrationConfig.apiUrl is required for api_poll integrations");
  }

  let apiKey = "";
  if (config.apiKeySecretArn) {
    apiKey = await resolveSecret(config.apiKeySecretArn);
  } else if (config.apiKey) {
    apiKey = config.apiKey;
  }

  return {
    apiUrl: config.apiUrl.trim(),
    authType: config.authType ?? "bearer",
    apiKey,
    apiKeyHeader: config.apiKeyHeader ?? "X-Api-Key",
    agencyCode: config.agencyCode ?? "",
    fieldMapping: normalizeDestToSource(config),
    priorityMapping: config.priorityMapping ?? {},
  };
}

const DEFAULT_PRIORITY_MAP: Record<string, "P1" | "P2" | "P3" | "P4"> = {
  "1": "P1",
  "2": "P2",
  "3": "P3",
  "4": "P4",
  "5": "P4",
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P4: "P4",
  IMMEDIATE: "P1",
  EMERGENCY: "P1",
  PRIORITY: "P2",
  URGENT: "P2",
  ROUTINE: "P3",
  "NON-EMERGENCY": "P4",
};

export function applyPriorityMapping(
  rawValue: string | undefined,
  mapping: Record<string, string>,
): "P1" | "P2" | "P3" | "P4" | undefined {
  if (!rawValue) return undefined;
  const explicit = mapping[rawValue] ?? mapping[rawValue.toUpperCase()];
  if (explicit && /^P[1-4]$/.test(explicit)) return explicit as "P1" | "P2" | "P3" | "P4";
  return DEFAULT_PRIORITY_MAP[rawValue] ?? DEFAULT_PRIORITY_MAP[rawValue.toUpperCase()];
}

export function extractField(payload: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = payload;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (current == null) return undefined;
  if (Array.isArray(current)) return current.join(",");
  return String(current);
}

const RC_DEST_FIELDS = new Set([
  "cadEventId",
  "incidentNumber",
  "incidentType",
  "priority",
  "location",
  "latitude",
  "longitude",
  "callerName",
  "callerPhone",
  "narrative",
  "units",
  "status",
  "responseCode",
  "agencyCode",
]);

function normalizeFieldMappingForApply(fieldMapping: Record<string, string>): Record<string, string> {
  const entries = Object.entries(fieldMapping);
  if (entries.length === 0) return fieldMapping;
  const looksLikeSrcToDest = entries.every(([, dest]) => RC_DEST_FIELDS.has(dest));
  if (!looksLikeSrcToDest) return fieldMapping;
  const destToSource: Record<string, string> = {};
  for (const [src, dest] of entries) destToSource[dest] = src;
  return destToSource;
}

export function applyFieldMapping(
  payload: Record<string, unknown>,
  config: ResolvedCadConfig,
  defaultMapper: (p: Record<string, unknown>) => Partial<RawCadIncident>,
): Partial<RawCadIncident> {
  const fieldMapping = normalizeFieldMappingForApply(config.fieldMapping);
  if (Object.keys(fieldMapping).length === 0) {
    return defaultMapper(payload);
  }

  const get = (dest: string) => {
    const src = fieldMapping[dest];
    return src ? extractField(payload, src) : undefined;
  };

  const result: Partial<RawCadIncident> = {
    cadEventId: get("cadEventId"),
    incidentNumber: get("incidentNumber"),
    incidentType: get("incidentType"),
    priority: get("priority"),
    location: get("location"),
    callerName: get("callerName"),
    callerPhone: get("callerPhone"),
    narrative: get("narrative"),
    units: get("units"),
    status: get("status"),
    responseCode: get("responseCode"),
    agencyCode: get("agencyCode"),
  };

  const latStr = get("latitude");
  const lngStr = get("longitude");
  if (latStr) result.latitude = parseFloat(latStr) || undefined;
  if (lngStr) result.longitude = parseFloat(lngStr) || undefined;

  return result;
}

export function buildAuthHeaders(config: ResolvedCadConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "RapidCortex-CadPoller/2.0",
  };

  switch (config.authType) {
    case "bearer":
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      break;
    case "api_key_header":
      if (config.apiKey) headers[config.apiKeyHeader] = config.apiKey;
      break;
    case "basic":
      if (config.apiKey) headers.Authorization = `Basic ${config.apiKey}`;
      break;
    case "no_auth":
      break;
  }

  return headers;
}

export function classifyHttpError(status: number, message: string): PollResult & { ok: false } {
  if (status === 401 || status === 403) {
    return { ok: false, errorType: "auth_error", message, latencyMs: 0, httpStatus: status };
  }
  if (status === 429) {
    return { ok: false, errorType: "rate_limited", message, latencyMs: 0, httpStatus: status };
  }
  return { ok: false, errorType: "network_error", message, latencyMs: 0, httpStatus: status };
}
