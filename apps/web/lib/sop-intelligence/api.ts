import type {
  SopIntelligenceCoachingItem,
  SopLibraryDocument,
  SopIntelligencePhase2Input,
} from "rapid-cortex-shared";

export type SopIntelPendingItem = {
  updateId: string;
  sopId: string;
  stepId: string;
  sopTitle: string;
  currentLang: string;
  suggestedLang: string;
  rationale: string;
  evidence: string[];
  evidenceCount: number;
  confidence: number;
  status: "pending" | "approved" | "deferred" | "dismissed";
  generatedAt: string;
  deferredUntil?: string;
};

export type SopIntelReport = {
  reportId: string;
  callId: string;
  dispatcherName?: string;
  telecom?: string;
  whatHappened: string;
  actionTaken?: string;
  sopGapIdentified: boolean;
  sopId?: string;
  stepId?: string;
  gapDescription?: string;
  level?: "HIGH" | "MED" | "LOW";
  createdAt: string;
  resolutionStatus?: string;
};

export type SopIntelSnapshot = {
  kpis: {
    callsAnalyzed: number;
    callsWithGaps: number;
    pendingUpdates: number;
    deviationRate: number;
  };
  library: SopLibraryDocument[];
  reports: SopIntelReport[];
  patterns: Array<{
    sopId: string;
    stepId: string;
    title: string;
    gapCount: number;
    suggestionGenerated: boolean;
  }>;
  pending: SopIntelPendingItem[];
  coaching: SopIntelligenceCoachingItem[];
  threshold: number;
};

async function sopRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `SOP Intelligence request failed (${res.status})`);
  }
  return json;
}

export function fetchSopIntelligenceSnapshot(): Promise<SopIntelSnapshot> {
  return sopRequest<SopIntelSnapshot>("/api/sop-intelligence/snapshot");
}

export function submitSopPhase2(body: SopIntelligencePhase2Input) {
  return sopRequest<{
    report: SopIntelReport;
    pattern: { gapCount: number; sopId: string; stepId: string } | null;
    thresholdReached: boolean;
    threshold: number;
  }>("/api/sop-intelligence/reports/phase2", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function actOnSopPending(updateId: string, action: "approve" | "defer" | "dismiss", reason?: string) {
  return sopRequest<{ item: SopIntelPendingItem }>(
    `/api/sop-intelligence/pending/${encodeURIComponent(updateId)}/${action}`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function saveSopLibraryStep(sopId: string, stepId: string, text: string) {
  return sopRequest<{ item: SopLibraryDocument }>(
    `/api/sop-intelligence/library/${encodeURIComponent(sopId)}/steps/${encodeURIComponent(stepId)}`,
    { method: "PUT", body: JSON.stringify({ text }) },
  );
}
