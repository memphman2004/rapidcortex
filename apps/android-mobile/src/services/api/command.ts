import axios from 'axios';
import { get } from './client';

const TEST_AGENCY_ID = 'test-agency';
const PLATFORM_AGENCY_ID = '__platform__';

export type CommandIncident = {
  incidentId: string;
  title?: string;
  status?: string;
  urgency?: string;
  category?: string;
  summary?: string;
  location?: string | null;
  escalationFlag?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CommandHome = {
  stats: { activeCalls: number; queue: number; onlineCount: number };
  assistRequests: CommandIncident[];
  incidents: CommandIncident[];
};

export type CommandStaffRow = {
  userId: string;
  displayName: string;
  role: string;
  position?: string;
  status: string;
  connectedAt?: string;
};

type LiveIncident = {
  incidentId: string;
  title?: string;
  status?: string;
  urgency?: string;
  category?: string;
  summary?: string;
  escalationFlag?: boolean;
  createdAt?: string;
  updatedAt?: string;
  callerAddressLine?: string | null;
  cadLocation?: string | null;
};

type LiveTranscriptSegment = {
  segmentIndex?: number;
  speaker?: string;
  text?: string;
  originalTranscript?: string;
};

function isMissingRoute(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

function isTenantAgencyId(raw: string | undefined): boolean {
  const id = (raw ?? '').trim();
  if (!id) return false;
  const lower = id.toLowerCase();
  return id !== PLATFORM_AGENCY_ID && lower !== 'platform';
}

export function resolveCommandAgencyId(agencyId?: string): string {
  return isTenantAgencyId(agencyId) ? (agencyId ?? '').trim() : TEST_AGENCY_ID;
}

function isOpenIncident(status: string | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'active' || s === 'in_progress';
}

function asCommandIncident(row: LiveIncident): CommandIncident {
  const loc = row.callerAddressLine?.trim() || row.cadLocation?.trim() || null;
  return {
    incidentId: row.incidentId,
    title: row.title ?? row.incidentId,
    status: row.status,
    urgency: row.urgency,
    category: row.category,
    summary: row.summary,
    location: loc,
    escalationFlag: row.escalationFlag,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function liveIncidentHome(items: LiveIncident[]): CommandHome {
  const open = items.map(asCommandIncident).filter((row) => isOpenIncident(row.status));
  const assist = open.filter((row) => row.escalationFlag === true);
  return {
    stats: { activeCalls: open.length, queue: open.length, onlineCount: 0 },
    assistRequests: assist,
    incidents: open,
  };
}

export async function getCommandHome(agencyId?: string): Promise<CommandHome> {
  const tenant = resolveCommandAgencyId(agencyId);
  const q = `?agencyId=${encodeURIComponent(tenant)}`;
  try {
    const res = await get<CommandHome>(`/api/field/command/home${q}`);
    return res.data;
  } catch (err) {
    if (!isMissingRoute(err)) throw err;
    const live = await get<{ items?: LiveIncident[] }>(`/api/incidents${q}`);
    return liveIncidentHome(live.data.items ?? []);
  }
}

export async function getCommandStaff(): Promise<{ items: CommandStaffRow[] }> {
  try {
    const res = await get<{ items: CommandStaffRow[] }>('/api/field/command/staff');
    return res.data;
  } catch (err) {
    if (isMissingRoute(err)) return { items: [] };
    throw err;
  }
}

export async function getCommandIncident(incidentId: string): Promise<{ incident: CommandIncident }> {
  const id = encodeURIComponent(incidentId);
  try {
    const res = await get<{ incident: CommandIncident }>(`/api/field/command/incidents/${id}`);
    return res.data;
  } catch (err) {
    if (!isMissingRoute(err)) throw err;
    const live = await get<LiveIncident>(`/api/incidents/${id}`);
    return { incident: asCommandIncident(live.data) };
  }
}

export async function getCommandTranscript(
  incidentId: string,
): Promise<{ items: Array<{ sequence: number; speaker: string; text: string }> }> {
  const id = encodeURIComponent(incidentId);
  try {
    const res = await get<{ items: Array<{ sequence: number; speaker: string; text: string }> }>(
      `/api/field/command/incidents/${id}/transcript`,
    );
    return res.data;
  } catch (err) {
    if (!isMissingRoute(err)) throw err;
    try {
      const live = await get<{ items?: LiveTranscriptSegment[] }>(`/api/incidents/${id}/transcripts`);
      const items = (live.data.items ?? []).map((seg, index) => {
        const speaker = (seg.speaker ?? 'system').toLowerCase();
        const mapped =
          speaker === 'caller' ? 'caller' : speaker === 'dispatcher' ? 'dispatcher' : 'rc_ai';
        const text = (seg.originalTranscript ?? seg.text ?? '').trim();
        return { sequence: seg.segmentIndex ?? index, speaker: mapped, text };
      });
      return { items };
    } catch (inner) {
      if (isMissingRoute(inner)) return { items: [] };
      throw inner;
    }
  }
}
