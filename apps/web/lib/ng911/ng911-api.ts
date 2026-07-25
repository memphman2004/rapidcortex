/**
 * NG9-1-1 assist client — relative `/api/ng911/*` and incident assist paths via Next.js BFF.
 */

import type {
  AdditionalDataPackage,
  ClinicianConsult,
  ClinicianConsultPatchBody,
  CrisisAgencyConfig,
  CrisisAgencyConfigUpsertBody,
  CrisisAssessment,
  CrisisDestination,
  CrisisDestinationType,
  CrisisDestinationUpsertBody,
  CrisisProtocol,
  CrisisProtocolUpsertBody,
  DataPathExport,
  DiversionSession,
  DiversionWorkflow,
  DiversionWorkflowUpsertBody,
  EidoDocument,
  Ng911CallProcessingMetrics,
  NgSecEvidencePack,
  PartnerEidoHandoffBody,
  PartnerEidoHandoffResult,
} from "rapid-cortex-shared";

class Ng911ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "Ng911ApiError";
    this.status = status;
  }
}

async function ng911Request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  }
  if (!res.ok) {
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const message =
      (o && typeof o.error === "string" && o.error) ||
      (o && typeof o.message === "string" && o.message) ||
      `NG9-1-1 request failed (${res.status})`;
    throw new Ng911ApiError(message, res.status);
  }
  return body as T;
}

export async function listDiversionWorkflows(): Promise<DiversionWorkflow[]> {
  const data = await ng911Request<{ items?: DiversionWorkflow[] }>("/api/ng911/diversion/workflows");
  return data.items ?? [];
}

export async function upsertDiversionWorkflow(
  body: DiversionWorkflowUpsertBody,
): Promise<DiversionWorkflow> {
  const data = await ng911Request<{ workflow: DiversionWorkflow }>("/api/ng911/diversion/workflows", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.workflow;
}

export async function deleteDiversionWorkflow(workflowId: string): Promise<void> {
  await ng911Request(`/api/ng911/diversion/workflows/${encodeURIComponent(workflowId)}`, {
    method: "DELETE",
  });
}

export async function rotateDiversionConfig(input?: {
  greeting?: string;
  enabled?: boolean;
}): Promise<{ publicKey: string; config: unknown }> {
  return ng911Request("/api/ng911/diversion/config/rotate", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export async function listDiversionSessions(limit = 100): Promise<DiversionSession[]> {
  const data = await ng911Request<{ items?: DiversionSession[] }>(
    `/api/ng911/diversion/sessions?limit=${limit}`,
  );
  return data.items ?? [];
}

export async function fetchNg911Metrics(from?: string, to?: string): Promise<Ng911CallProcessingMetrics> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return ng911Request(`/api/ng911/metrics${suffix}`);
}

export async function fetchNgSecEvidence(from?: string, to?: string): Promise<NgSecEvidencePack> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return ng911Request(`/api/ng911/ng-sec-evidence${suffix}`);
}

export async function getIncidentEido(
  incidentId: string,
  includeAdditionalData = false,
): Promise<EidoDocument> {
  const qs = includeAdditionalData ? "?includeAdditionalData=1" : "";
  const data = await ng911Request<{ eido: EidoDocument }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/eido${qs}`,
  );
  return data.eido;
}

export async function getAdditionalDataPackage(
  incidentId: string,
): Promise<AdditionalDataPackage | null> {
  try {
    const data = await ng911Request<{ package: AdditionalDataPackage }>(
      `/api/incidents/${encodeURIComponent(incidentId)}/additional-data`,
    );
    return data.package;
  } catch (e) {
    if (e instanceof Ng911ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function autoBuildAdditionalData(
  incidentId: string,
  body: Record<string, unknown> = {},
): Promise<AdditionalDataPackage> {
  const data = await ng911Request<{ package: AdditionalDataPackage }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/additional-data/auto-build`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.package;
}

export async function putAdditionalDataPackage(
  incidentId: string,
  body: { items: AdditionalDataPackage["items"]; replaceAll?: boolean },
): Promise<AdditionalDataPackage> {
  const data = await ng911Request<{ package: AdditionalDataPackage }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/additional-data`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  return data.package;
}

// ── Crisis diversion ────────────────────────────────────────────────────────

export async function getCrisisConfig(): Promise<CrisisAgencyConfig> {
  const data = await ng911Request<{ config: CrisisAgencyConfig }>("/api/ng911/crisis/config");
  return data.config;
}

export async function upsertCrisisConfig(
  body: CrisisAgencyConfigUpsertBody,
): Promise<CrisisAgencyConfig> {
  const data = await ng911Request<{ config: CrisisAgencyConfig }>("/api/ng911/crisis/config", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.config;
}

export async function listCrisisProtocols(): Promise<CrisisProtocol[]> {
  const data = await ng911Request<{ items?: CrisisProtocol[] }>("/api/ng911/crisis/protocols");
  return data.items ?? [];
}

export async function upsertCrisisProtocol(
  body: CrisisProtocolUpsertBody,
): Promise<CrisisProtocol> {
  const data = await ng911Request<{ protocol: CrisisProtocol }>("/api/ng911/crisis/protocols", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.protocol;
}

export async function deleteCrisisProtocol(protocolId: string): Promise<void> {
  await ng911Request(`/api/ng911/crisis/protocols/${encodeURIComponent(protocolId)}`, {
    method: "DELETE",
  });
}

export async function listCrisisDestinations(): Promise<CrisisDestination[]> {
  const data = await ng911Request<{ items?: CrisisDestination[] }>(
    "/api/ng911/crisis/destinations",
  );
  return data.items ?? [];
}

export async function upsertCrisisDestination(
  body: CrisisDestinationUpsertBody,
): Promise<CrisisDestination> {
  const data = await ng911Request<{ destination: CrisisDestination }>(
    "/api/ng911/crisis/destinations",
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.destination;
}

export async function deleteCrisisDestination(destinationId: string): Promise<void> {
  await ng911Request(`/api/ng911/crisis/destinations/${encodeURIComponent(destinationId)}`, {
    method: "DELETE",
  });
}

export async function startCrisisAssessment(body: {
  protocolId?: string;
  incidentId?: string;
}): Promise<{ assessment: CrisisAssessment; protocol: CrisisProtocol }> {
  return ng911Request("/api/ng911/crisis/assessments/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function answerCrisisStep(body: {
  assessmentId: string;
  stepId: string;
  answer: "yes" | "no" | "unknown";
}): Promise<CrisisAssessment> {
  const data = await ng911Request<{ assessment: CrisisAssessment }>(
    "/api/ng911/crisis/assessments/answer",
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.assessment;
}

export async function selectCrisisDestination(body: {
  assessmentId: string;
  destinationType: CrisisDestinationType;
  destinationId?: string;
  callerPhoneE164?: string;
}): Promise<CrisisAssessment> {
  const data = await ng911Request<{ assessment: CrisisAssessment }>(
    "/api/ng911/crisis/assessments/select-destination",
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.assessment;
}

export async function requestCrisisWarmTransfer(body: {
  assessmentId: string;
  destinationId?: string;
  phoneE164?: string;
  notes?: string;
}): Promise<CrisisAssessment> {
  const data = await ng911Request<{ assessment: CrisisAssessment }>(
    "/api/ng911/crisis/assessments/warm-transfer",
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.assessment;
}

export async function completeCrisisAssessment(body: {
  assessmentId: string;
  phoneResolved?: boolean;
  divertedFromLe?: boolean;
  divertedFromEms?: boolean;
  outcomeNotes?: string;
}): Promise<CrisisAssessment> {
  const data = await ng911Request<{ assessment: CrisisAssessment }>(
    "/api/ng911/crisis/assessments/complete",
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.assessment;
}

export async function listClinicianConsults(): Promise<ClinicianConsult[]> {
  const data = await ng911Request<{ items?: ClinicianConsult[] }>(
    "/api/ng911/crisis/clinician-queue",
  );
  return data.items ?? [];
}

export async function createClinicianConsult(body: {
  assessmentId: string;
  summary?: string;
}): Promise<{ consult: ClinicianConsult; assessment: CrisisAssessment }> {
  return ng911Request("/api/ng911/crisis/clinician-consult", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchClinicianConsult(
  consultId: string,
  body: ClinicianConsultPatchBody,
): Promise<ClinicianConsult> {
  const data = await ng911Request<{ consult: ClinicianConsult }>(
    `/api/ng911/crisis/clinician-queue/${encodeURIComponent(consultId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return data.consult;
}

export async function partnerEidoHandoff(body: PartnerEidoHandoffBody): Promise<PartnerEidoHandoffResult> {
  return ng911Request("/api/ng911/eido/partner-handoff", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchDataPathExport(from?: string, to?: string): Promise<DataPathExport> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return ng911Request(`/api/ng911/datapath-export${suffix}`);
}

export { Ng911ApiError };
