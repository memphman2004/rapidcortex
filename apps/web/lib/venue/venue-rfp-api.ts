import type {
  VenueCaseActionBody,
  VenueCustodyTransferBody,
  VenueEvidenceConfirmBody,
  VenueEvidenceUploadBody,
  VenueFormSchemaConfig,
  VenueIntegrationImportBody,
  VenueSecureShareBody,
} from "rapid-cortex-shared";
import type { z } from "zod";
import { venueFormSchemaPutBodySchema } from "rapid-cortex-shared";

type VenueFormSchemaPutBody = z.infer<typeof venueFormSchemaPutBodySchema>;

export type VenueAnalyticsBundle = {
  venueCode: string;
  startDate: string;
  endDate: string;
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byZone: Record<string, number>;
  byDay: { day: string; count: number }[];
  avgResponseSeconds: number | null;
};

export type VenueEvidenceItem = {
  evidenceId: string;
  incidentId: string;
  venueCode: string;
  agencyId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  kind: VenueEvidenceUploadBody["kind"];
  label?: string;
  s3Key: string;
  status: "pending_upload" | "confirmed" | "corrupted";
  sealed?: boolean;
  sealedAt?: string;
  immutableOriginal?: boolean;
  uploadedBy: string;
  uploadedByLabel: string;
  confirmedAt?: string;
  createdAt: string;
};

export type VenueCustodyEntry = {
  custodyId: string;
  evidenceId: string;
  fromCustodianLabel: string;
  toCustodianLabel: string;
  reason: string;
  transferredAt: string;
};

export type VenueRfpAuditItem = {
  eventType: string;
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  resourceType: string;
  resourceId: string;
  incidentId?: string;
  timestamp: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type VenueReportItem = {
  reportId: string;
  incidentId: string;
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
  s3Key?: string;
};

export type VenueCaseIncident = {
  incidentId: string;
  venueCode: string;
  agencyId?: string;
  status: string;
  type: string;
  zoneCode: string;
  zoneLabel: string;
  description: string;
  assignedTo: string | null;
  assignedLabel?: string | null;
  linkedIncidentIds?: string[];
  approvalStatus?: string;
  disposition?: string | null;
  statusHistory?: { at: string; from: string; to: string; actorId?: string }[];
  approvalHistory?: { at: string; status: string; actorId?: string; note?: string }[];
  reopenHistory?: { at: string; actorId?: string; reason?: string; note?: string }[];
  customFields?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
};

function rfpRoot(venueCode: string): string {
  return `/api/venue/rfp/${encodeURIComponent(venueCode.trim().toUpperCase())}`;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

async function venueRfpFetch<T>(
  venueCode: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${rfpRoot(venueCode)}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return parseJson<T>(res);
}

export async function fetchVenueCase(
  venueCode: string,
  incidentId: string,
): Promise<VenueCaseIncident> {
  const data = await venueRfpFetch<{ incident: VenueCaseIncident }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/case`,
  );
  return data.incident;
}

export async function postVenueCaseAction(
  venueCode: string,
  incidentId: string,
  body: VenueCaseActionBody,
): Promise<VenueCaseIncident> {
  const data = await venueRfpFetch<{ incident: VenueCaseIncident }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/case/actions`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.incident;
}

export async function fetchVenueEvidenceList(
  venueCode: string,
  incidentId: string,
): Promise<VenueEvidenceItem[]> {
  const data = await venueRfpFetch<{ items: VenueEvidenceItem[] }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/evidence`,
  );
  return data.items ?? [];
}

export async function requestVenueEvidenceUpload(
  venueCode: string,
  incidentId: string,
  body: VenueEvidenceUploadBody,
): Promise<{ evidenceId: string; uploadUrl: string; s3Key: string; expiresIn: number }> {
  return venueRfpFetch(venueCode, `/incidents/${encodeURIComponent(incidentId)}/evidence/upload-url`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function confirmVenueEvidenceUpload(
  venueCode: string,
  incidentId: string,
  body: VenueEvidenceConfirmBody,
): Promise<VenueEvidenceItem> {
  const data = await venueRfpFetch<{ evidence: VenueEvidenceItem }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/evidence/confirm`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.evidence;
}

export async function sealVenueEvidenceItem(
  venueCode: string,
  incidentId: string,
  evidenceId: string,
): Promise<VenueEvidenceItem> {
  const data = await venueRfpFetch<{ evidence: VenueEvidenceItem }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}/seal`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return data.evidence;
}

export async function transferVenueEvidenceCustody(
  venueCode: string,
  incidentId: string,
  body: VenueCustodyTransferBody,
): Promise<VenueCustodyEntry> {
  const data = await venueRfpFetch<{ entry: VenueCustodyEntry }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(body.evidenceId)}/custody`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.entry;
}

export async function fetchVenueEvidenceCustody(
  venueCode: string,
  incidentId: string,
  evidenceId: string,
): Promise<VenueCustodyEntry[]> {
  const data = await venueRfpFetch<{ items: VenueCustodyEntry[] }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}/custody`,
  );
  return data.items ?? [];
}

export async function fetchVenueEvidenceDownloadUrl(
  venueCode: string,
  incidentId: string,
  evidenceId: string,
): Promise<{ downloadUrl: string; expiresIn?: number }> {
  return venueRfpFetch(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}/download-url`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchVenueRfpAuditForVenue(
  venueCode: string,
  opts?: { incidentId?: string; limit?: number },
): Promise<VenueRfpAuditItem[]> {
  const q = new URLSearchParams();
  if (opts?.incidentId) q.set("incidentId", opts.incidentId);
  if (opts?.limit) q.set("limit", String(opts.limit));
  const qs = q.toString() ? `?${q}` : "";
  const data = await venueRfpFetch<{ items: VenueRfpAuditItem[] }>(venueCode, `/audit${qs}`);
  return data.items ?? [];
}

export async function fetchVenueRfpAuditForIncident(
  venueCode: string,
  incidentId: string,
): Promise<VenueRfpAuditItem[]> {
  const data = await venueRfpFetch<{ items: VenueRfpAuditItem[] }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/audit`,
  );
  return data.items ?? [];
}

export async function generateVenueIncidentReport(
  venueCode: string,
  incidentId: string,
  ttlHours?: number,
): Promise<{ reportId: string; reportUrl: string; expiresAt: string }> {
  return venueRfpFetch(venueCode, `/incidents/${encodeURIComponent(incidentId)}/reports`, {
    method: "POST",
    body: JSON.stringify({ ttlHours }),
  });
}

export async function fetchVenueIncidentReports(
  venueCode: string,
  incidentId: string,
): Promise<VenueReportItem[]> {
  const data = await venueRfpFetch<{ items: VenueReportItem[] }>(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/reports`,
  );
  return data.items ?? [];
}

export async function distributeVenueIncidentReport(
  venueCode: string,
  incidentId: string,
  reportId: string,
  body: VenueSecureShareBody,
): Promise<{ distributionId: string; reportUrl: string; expiresAt: string }> {
  return venueRfpFetch(
    venueCode,
    `/incidents/${encodeURIComponent(incidentId)}/reports/${encodeURIComponent(reportId)}/distribute`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchVenueRfpAnalytics(
  venueCode: string,
  startDate?: string,
  endDate?: string,
): Promise<VenueAnalyticsBundle> {
  const q = new URLSearchParams();
  if (startDate) q.set("startDate", startDate);
  if (endDate) q.set("endDate", endDate);
  const qs = q.toString() ? `?${q}` : "";
  return venueRfpFetch(venueCode, `/analytics${qs}`);
}

export async function exportVenueIncidentsCsv(
  venueCode: string,
  startDate?: string,
  endDate?: string,
): Promise<{ csv: string; count: number }> {
  const q = new URLSearchParams();
  if (startDate) q.set("startDate", startDate);
  if (endDate) q.set("endDate", endDate);
  const qs = q.toString() ? `?${q}` : "";
  return venueRfpFetch(venueCode, `/export/incidents${qs}`);
}

export async function fetchVenueFormSchema(venueCode: string): Promise<VenueFormSchemaConfig> {
  const data = await venueRfpFetch<{ schema: VenueFormSchemaConfig }>(venueCode, `/form-schema`);
  return data.schema;
}

export async function putVenueFormSchema(
  venueCode: string,
  body: VenueFormSchemaPutBody,
): Promise<VenueFormSchemaConfig> {
  const data = await venueRfpFetch<{ schema: VenueFormSchemaConfig }>(venueCode, `/form-schema`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.schema;
}

export async function runVenueIntegrationImport(
  venueCode: string,
  body: VenueIntegrationImportBody,
): Promise<{ imported: number; skipped: number; dryRun: boolean; runId: string }> {
  return venueRfpFetch(venueCode, `/integrations/import`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sha256HexFromBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
