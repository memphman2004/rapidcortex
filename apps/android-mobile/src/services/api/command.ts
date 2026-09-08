import { get } from './client';

export type CommandIncident = {
  incidentId: string;
  title?: string;
  status?: string;
  urgency?: string;
  category?: string;
  summary?: string;
  location?: string | null;
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

export async function getCommandHome(agencyId?: string): Promise<CommandHome> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : '';
  const res = await get<CommandHome>(`/api/field/command/home${q}`);
  return res.data;
}

export async function getCommandStaff(): Promise<{ items: CommandStaffRow[] }> {
  const res = await get<{ items: CommandStaffRow[] }>('/api/field/command/staff');
  return res.data;
}

export async function getCommandIncident(incidentId: string): Promise<{ incident: CommandIncident }> {
  const res = await get<{ incident: CommandIncident }>(
    `/api/field/command/incidents/${encodeURIComponent(incidentId)}`,
  );
  return res.data;
}

export async function getCommandTranscript(
  incidentId: string,
): Promise<{ items: Array<{ sequence: number; speaker: string; text: string }> }> {
  const res = await get<{ items: Array<{ sequence: number; speaker: string; text: string }> }>(
    `/api/field/command/incidents/${encodeURIComponent(incidentId)}/transcript`,
  );
  return res.data;
}
