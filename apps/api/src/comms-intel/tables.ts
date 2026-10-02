import { env } from "../lib/env.js";

export function contextAddressCacheTable(): string {
  return env.contextAddressCacheTable || process.env.CONTEXT_ADDRESS_CACHE_TABLE?.trim() || "";
}

export function contextSafetyFlagsTable(): string {
  return env.contextSafetyFlagsTable || process.env.CONTEXT_SAFETY_FLAGS_TABLE?.trim() || "";
}

export function dailyMetricsSnapshotTable(): string {
  return env.dailyMetricsSnapshotTable || process.env.DAILY_METRICS_SNAPSHOT_TABLE?.trim() || "";
}

export function vaultIncidentsTable(): string {
  return env.vaultIncidentsTable || process.env.VAULT_INCIDENTS_TABLE?.trim() || "";
}

export function vaultLocationIndexTable(): string {
  return env.vaultLocationIndexTable || process.env.VAULT_LOCATION_INDEX_TABLE?.trim() || "";
}

export function vaultIngestionJobsTable(): string {
  return env.vaultIngestionJobsTable || process.env.VAULT_INGESTION_JOBS_TABLE?.trim() || "";
}

export function vaultIngestBucket(): string {
  return env.vaultIngestBucket || process.env.VAULT_INGEST_BUCKET?.trim() || "";
}

export function agencyPk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

export function addrSk(normalizedAddress: string): string {
  return `ADDR#${normalizedAddress}`;
}

export function locationSk(normalizedAddress: string): string {
  return `LOCATION#${normalizedAddress}`;
}

export function jobSk(jobId: string): string {
  return `JOB#${jobId}`;
}

export function dateSk(date: string): string {
  return `DATE#${date}`;
}
