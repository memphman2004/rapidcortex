/**
 * Phase 2 mock data layer — single import surface for offline/demo UX.
 * Live API paths use the same shapes via `lib/queries.ts` when `isApiConfigured()`.
 */
import {
  mockGetIncident,
  mockGetLatestAnalysis,
  mockGetTranscript,
  mockListIncidents,
  MOCK_ANALYSES,
  MOCK_INCIDENTS,
  MOCK_TRANSCRIPTS,
} from "@/lib/mock-data";

export const mockDashboardStore = {
  incidents: MOCK_INCIDENTS,
  transcriptsByIncident: MOCK_TRANSCRIPTS,
  analysesByIncident: MOCK_ANALYSES,
  listIncidents: mockListIncidents,
  getIncident: mockGetIncident,
  getTranscript: mockGetTranscript,
  getLatestAnalysis: mockGetLatestAnalysis,
};
