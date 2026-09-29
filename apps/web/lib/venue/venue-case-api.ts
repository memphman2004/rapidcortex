/**
 * Venue Case API — client-side calls for RFP 2396IP features.
 *
 * All endpoints are agencyId-scoped via the JWT claim server-side.
 * The client never passes agencyId in the URL for case/evidence routes
 * (the API derives it from the auth token); the agencyId path param is
 * only used for the per-venue admin endpoints (form-schema, analytics,
 * import, export).
 */

import type {
  VenueCaseActionBody,
  VenueEvidenceUploadBody,
  VenueEvidenceConfirmBody,
  VenueCustodyTransferBody,
  VenueSecureShareBody,
  VenueFormSchemaConfig,
  VenueIntegrationImportBody,
} from "rapid-cortex-shared";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(body || `Request failed: ${res.status}`), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

// ─── Case workflow ────────────────────────────────────────────────────────────

export async function performVenueCaseAction(
  incidentId: string,
  body: VenueCaseActionBody,
): Promise<{
  action: string;
  previousStatus: string;
  newStatus: string;
  updatedAt: string;
}> {
  return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/case/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function requestEvidenceUploadUrl(
  incidentId: string,
  body: VenueEvidenceUploadBody,
): Promise<{ evidenceId: string; uploadUrl: string; s3Key: string; expiresIn: number }> {
  return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/case/evidence/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function confirmEvidenceUpload(
  incidentId: string,
  body: VenueEvidenceConfirmBody,
): Promise<{ evidenceId: string; status: string; confirmedAt?: string }> {
  return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/case/evidence/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listEvidence(incidentId: string): Promise<{
  evidence: Array<{
    evidenceId: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    kind: string;
    label?: string;
    s3Key: string;
    status: string;
    uploadedByLabel: string;
    confirmedAt?: string;
    createdAt: string;
  }>;
}> {
  return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/case/evidence`);
}

export async function getEvidenceDownloadUrl(
  incidentId: string,
  evidenceId: string,
): Promise<{ url: string }> {
  return apiFetch(
    `/api/incidents/${encodeURIComponent(incidentId)}/case/evidence/${encodeURIComponent(evidenceId)}/download`,
  );
}

export async function listCustodyChain(
  incidentId: string,
  evidenceId: string,
): Promise<{
  custody: Array<{
    custodyId: string;
    fromCustodianLabel: string;
    toCustodianLabel: string;
    reason: string;
    transferredAt: string;
  }>;
}> {
  return apiFetch(
    `/api/incidents/${encodeURIComponent(incidentId)}/case/evidence/${encodeURIComponent(evidenceId)}/custody`,
  );
}

export async function transferCustody(
  incidentId: string,
  body: VenueCustodyTransferBody,
): Promise<{ custodyId: string; transferredAt: string }> {
  const evidenceId = body.evidenceId;
  return apiFetch(
    `/api/incidents/${encodeURIComponent(incidentId)}/case/evidence/${encodeURIComponent(evidenceId)}/custody`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function fetchVenueAuditLog(
  incidentId: string,
  limit = 100,
): Promise<{ audit: unknown[] }> {
  return apiFetch(
    `/api/incidents/${encodeURIComponent(incidentId)}/case/audit?limit=${limit}`,
  );
}

// ─── Report & share ───────────────────────────────────────────────────────────

export async function requestIncidentPdfReport(
  incidentId: string,
): Promise<{ reportId: string; downloadUrl: string; status: string }> {
  return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/case/report`, {
    method: "POST",
  });
}

export async function createSecureShare(
  incidentId: string,
  body: VenueSecureShareBody,
): Promise<{ shareId: string; shareToken: string; expiresAt: string; shareUrl: string }> {
  return apiFetch(`/api/incidents/${encodeURIComponent(incidentId)}/case/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function fetchVenueAnalyticsTrends(
  agencyId: string,
  params: { fromDate?: string; toDate?: string } = {},
): Promise<{
  totalIncidents: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
  avgResolutionMinutes: number | null;
  generatedAt: string;
}> {
  const qs = new URLSearchParams();
  if (params.fromDate) qs.set("fromDate", params.fromDate);
  if (params.toDate) qs.set("toDate", params.toDate);
  return apiFetch(`/api/venue/${encodeURIComponent(agencyId)}/analytics/trends?${qs}`);
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function runVenueImport(
  agencyId: string,
  body: VenueIntegrationImportBody,
): Promise<{
  importId: string;
  source: string;
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{ externalId: string; reason: string }>;
  dryRun: boolean;
  completedAt: string;
}> {
  return apiFetch(`/api/venue/${encodeURIComponent(agencyId)}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Form schema ──────────────────────────────────────────────────────────────

export async function fetchVenueFormSchema(
  agencyId: string,
): Promise<{ schema: VenueFormSchemaConfig }> {
  return apiFetch(`/api/venue/${encodeURIComponent(agencyId)}/form-schema`);
}

export async function putVenueFormSchema(
  agencyId: string,
  schema: Omit<VenueFormSchemaConfig, "updatedAt" | "updatedBy">,
): Promise<{ schema: VenueFormSchemaConfig }> {
  return apiFetch(`/api/venue/${encodeURIComponent(agencyId)}/form-schema`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schema),
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function buildCsvExportUrl(
  agencyId: string,
  params: { fromDate?: string; toDate?: string } = {},
): string {
  const qs = new URLSearchParams();
  if (params.fromDate) qs.set("fromDate", params.fromDate);
  if (params.toDate) qs.set("toDate", params.toDate);
  return `/api/venue/${encodeURIComponent(agencyId)}/export/csv?${qs}`;
}
