import {
  type AdminUserRow,
  fetchAdminUsers,
  fetchAnalyses,
  fetchAuditEvents,
  fetchCallerCard,
  fetchDemoScenarios,
  fetchIncident,
  fetchIncidents,
  fetchTranscript,
  isApiConfigured,
  postAnalyze,
} from "@/lib/api";
import { isCallerCardEnabled, isOfflineDemoDataEnabled } from "@/lib/runtime-flags";
import { listDemoScenarioRows } from "rapid-cortex-shared";
import {
  mockGetIncident,
  mockGetLatestAnalysis,
  mockGetTranscript,
  mockListIncidents,
} from "@/lib/mock-data";
import type {
  AIAnalysis,
  AuditEvent,
  CallerCardResponse,
  ConfidenceAnalysis,
  Incident,
  TranscriptSegment,
} from "rapid-cortex-shared";

export async function loadIncidents(): Promise<Incident[]> {
  if (isApiConfigured()) return fetchIncidents();
  if (isOfflineDemoDataEnabled()) return mockListIncidents();
  return [];
}

export async function loadIncident(id: string): Promise<Incident | null> {
  if (isApiConfigured()) {
    return fetchIncident(id);
  }
  if (isOfflineDemoDataEnabled()) return mockGetIncident(id);
  return null;
}

export async function loadCallerCard(incidentId: string): Promise<CallerCardResponse | null> {
  if (!isCallerCardEnabled() || !isApiConfigured()) return null;
  try {
    return await fetchCallerCard(incidentId);
  } catch {
    return null;
  }
}

export async function loadTranscript(
  incidentId: string,
): Promise<TranscriptSegment[]> {
  if (isApiConfigured()) {
    return fetchTranscript(incidentId);
  }
  if (isOfflineDemoDataEnabled()) return mockGetTranscript(incidentId);
  return [];
}

export async function loadLatestAnalysis(
  incidentId: string,
): Promise<AIAnalysis | null> {
  if (isApiConfigured()) {
    const list = await fetchAnalyses(incidentId);
    const primary = list.find((a) => !a.analysisRecordKind || a.analysisRecordKind === "dispatch");
    return primary ?? null;
  }
  if (isOfflineDemoDataEnabled()) return mockGetLatestAnalysis(incidentId);
  return null;
}

export async function loadLatestFieldConfidence(
  incidentId: string,
): Promise<ConfidenceAnalysis | null> {
  if (isApiConfigured()) {
    const list = await fetchAnalyses(incidentId);
    const row = list.find((a) => a.analysisRecordKind === "field_confidence");
    return row?.fieldConfidenceAnalysis ?? null;
  }
  return null;
}

export async function runAnalysis(incidentId: string): Promise<AIAnalysis> {
  if (!isApiConfigured()) {
    if (!isOfflineDemoDataEnabled()) {
      throw new Error(
        "API is not configured. Set NEXT_PUBLIC_AUTH_PROXY=1 and API_UPSTREAM_BASE (or NEXT_PUBLIC_API_BASE). For local-only mock incidents, set NEXT_PUBLIC_OFFLINE_DEMO_MODE=1.",
      );
    }
    const existing = mockGetLatestAnalysis(incidentId);
    if (!existing) throw new Error("No analysis available in offline demo mode for this incident.");
    return {
      ...existing,
      analysisId: `analysis_${Date.now()}`,
      createdAt: new Date().toISOString(),
      confidence: Math.min(0.99, existing.confidence + 0.02),
    };
  }
  return postAnalyze(incidentId);
}

export async function loadAuditEvents(limit = 50): Promise<AuditEvent[]> {
  if (!isApiConfigured()) return [];
  return fetchAuditEvents(limit);
}

export async function loadAdminUsers(): Promise<AdminUserRow[]> {
  if (!isApiConfigured()) return [];
  return fetchAdminUsers();
}

export async function loadDemoScenarios() {
  if (isApiConfigured()) return fetchDemoScenarios();
  return listDemoScenarioRows();
}
