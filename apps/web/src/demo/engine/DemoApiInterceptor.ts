import { isDemoModeActive } from "./demo-mode-gate";
import { getDemoPlaybackEngine } from "./DemoPlaybackEngine";
import { locationLabel } from "../fixtures/locations";
import { DEMO_AGENCY_ID, type DemoAgencyState, type DemoIncident } from "../types";

export interface DemoHttpClient {
  request(path: string, init?: RequestInit): Promise<unknown>;
}

function emptyState(): DemoAgencyState | null {
  return getDemoPlaybackEngine().getState();
}

function incidentItems(state: DemoAgencyState) {
  return [...state.activeIncidents, ...state.closedIncidents].map((incident) => ({
    incidentId: incident.id,
    agencyId: DEMO_AGENCY_ID,
    title: incident.title,
    category: incident.discipline === "law" ? "police" : incident.discipline === "fire" ? "fire" : "medical",
    urgency: incident.major || incident.mci ? "critical" : "high",
    status: incident.status === "closed" ? "completed" : "active",
    source: "demo",
    summary: incident.continuity[incident.continuity.length - 1] ?? incident.title,
    location: locationLabel(incident.locationId),
    demo: true,
  }));
}

function transcriptItems(incident: DemoIncident) {
  return incident.transcript.map((line, index) => ({
    segmentId: `${incident.id}-seg-${index}`,
    incidentId: incident.id,
    agencyId: DEMO_AGENCY_ID,
    speaker: line.speaker,
    text: line.text,
    timestamp: new Date(Date.UTC(2026, 3, 18, 14, 0, line.offsetSeconds)).toISOString(),
  }));
}

/** Builds a fictional response for one API path. Never calls the network. */
export function resolveDemoHttp<T>(path: string, _init?: RequestInit): T {
  const state = emptyState();
  const bare = path.split("?")[0] ?? path;
  if (!state) {
    return { items: [], agencyId: DEMO_AGENCY_ID, demo: true, path: bare } as T;
  }

  if (bare === "/api/incidents" || bare.endsWith("/incidents")) {
    return { items: incidentItems(state), agencyId: DEMO_AGENCY_ID, demo: true } as T;
  }

  const transcript = bare.match(/\/api\/incidents\/([^/]+)\/transcript$/);
  if (transcript) {
    const incidentId = decodeURIComponent(transcript[1] ?? "");
    const incident = [...state.activeIncidents, ...state.closedIncidents].find((item) => item.id === incidentId);
    return { items: incident ? transcriptItems(incident) : [], agencyId: DEMO_AGENCY_ID, demo: true } as T;
  }

  const oneIncident = bare.match(/\/api\/incidents\/([^/]+)$/);
  if (oneIncident) {
    const incidentId = decodeURIComponent(oneIncident[1] ?? "");
    const match = incidentItems(state).find((item) => item.incidentId === incidentId);
    return (match ?? { incidentId, agencyId: DEMO_AGENCY_ID, demo: true, title: "Maplewood demo incident" }) as T;
  }

  if (bare.includes("unit")) {
    return {
      items: state.units.map((unit) => ({ ...unit, agencyId: DEMO_AGENCY_ID, demo: true })),
      agencyId: DEMO_AGENCY_ID,
      demo: true,
    } as T;
  }

  return {
    items: [],
    agencyId: DEMO_AGENCY_ID,
    demo: true,
    agencyName: state.agency.name,
    path: bare,
  } as T;
}

/**
 * Replaces a client's request method while Demo Mode is active.
 * The original method is what would have reached production; it is not called.
 */
export function applyDemoApiInterceptor<T extends DemoHttpClient>(client: T): T {
  const original = client.request.bind(client);
  client.request = (path: string, init?: RequestInit) => {
    if (!isDemoModeActive()) return original(path, init);
    return Promise.resolve(resolveDemoHttp(path, init));
  };
  return client;
}
