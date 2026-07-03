import type {
  AssignChannelBody,
  ChannelConfig,
  CreateChannelBody,
  IncidentChannelAssignment,
  PatchChannelBody,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { ChannelConfigRepository } from "../repositories/channelConfigRepository.js";
import { IncidentChannelAssignmentRepository } from "../repositories/incidentChannelAssignmentRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { getIncidentForUser } from "../lib/authz.js";
import type { UserContext } from "rapid-cortex-shared";

const ASSIGNMENT_TTL_SECONDS = 90 * 24 * 60 * 60;

const configRepo = new ChannelConfigRepository();
const assignmentRepo = new IncidentChannelAssignmentRepository();
const incidentRepo = new IncidentRepository();

export async function listAgencyChannels(agencyId: string): Promise<ChannelConfig[]> {
  const rows = await configRepo.listByAgency(agencyId);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createChannel(
  user: UserContext,
  body: CreateChannelBody,
): Promise<ChannelConfig> {
  const now = new Date().toISOString();
  const record: ChannelConfig = {
    agencyId: user.agencyId,
    channelId: makeId("ch"),
    name: body.name.trim(),
    description: body.description?.trim() || undefined,
    discipline: body.discipline,
    talkGroupId: body.talkGroupId?.trim() || undefined,
    color: body.color,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: user.userId,
  };
  await configRepo.put(record);
  return record;
}

export async function patchChannel(
  agencyId: string,
  channelId: string,
  body: PatchChannelBody,
): Promise<ChannelConfig> {
  const existing = await configRepo.get(agencyId, channelId);
  if (!existing) throw new Error("CHANNEL_NOT_FOUND");

  const updatedAt = new Date().toISOString();
  const patch: Partial<ChannelConfig> & { updatedAt: string } = { updatedAt };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description.trim() || undefined;
  if (body.discipline !== undefined) patch.discipline = body.discipline;
  if (body.talkGroupId !== undefined) patch.talkGroupId = body.talkGroupId.trim() || undefined;
  if (body.color !== undefined) patch.color = body.color;
  if (body.active !== undefined) patch.active = body.active;

  await configRepo.patch(agencyId, channelId, patch);
  const next = await configRepo.get(agencyId, channelId);
  if (!next) throw new Error("CHANNEL_NOT_FOUND");
  return next;
}

export async function deactivateChannel(agencyId: string, channelId: string): Promise<ChannelConfig> {
  return patchChannel(agencyId, channelId, { active: false });
}

export async function listIncidentChannels(
  user: UserContext,
  incidentId: string,
): Promise<IncidentChannelAssignment[]> {
  const incident = await getIncidentForUser(incidentRepo, incidentId, user);
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");
  return assignmentRepo.listByIncident(incidentId);
}

export async function assignChannelToIncident(
  user: UserContext,
  incidentId: string,
  body: AssignChannelBody,
): Promise<IncidentChannelAssignment> {
  const incident = await getIncidentForUser(incidentRepo, incidentId, user);
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");

  const channel = await configRepo.get(user.agencyId, body.channelId);
  if (!channel || !channel.active) throw new Error("CHANNEL_NOT_FOUND");

  const existing = await assignmentRepo.get(incidentId, body.channelId);
  if (existing?.active) throw new Error("CHANNEL_ALREADY_ASSIGNED");

  const now = new Date().toISOString();
  const record: IncidentChannelAssignment = {
    incidentId,
    channelId: body.channelId,
    agencyId: user.agencyId,
    channelName: channel.name,
    discipline: channel.discipline,
    assignedAt: now,
    assignedBy: user.userId,
    notes: body.notes?.trim() || undefined,
    active: true,
    ttl: Math.floor(Date.now() / 1000) + ASSIGNMENT_TTL_SECONDS,
  };
  await assignmentRepo.put(record);
  return record;
}

export async function patchIncidentChannelNotes(
  user: UserContext,
  incidentId: string,
  channelId: string,
  notes: string | undefined,
): Promise<IncidentChannelAssignment> {
  const incident = await getIncidentForUser(incidentRepo, incidentId, user);
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");

  const existing = await assignmentRepo.get(incidentId, channelId);
  if (!existing || !existing.active || existing.agencyId !== user.agencyId) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  await assignmentRepo.patchNotes(incidentId, channelId, notes?.trim() || undefined);
  const next = await assignmentRepo.get(incidentId, channelId);
  if (!next) throw new Error("ASSIGNMENT_NOT_FOUND");
  return next;
}

export async function removeIncidentChannelAssignment(
  user: UserContext,
  incidentId: string,
  channelId: string,
): Promise<void> {
  const incident = await getIncidentForUser(incidentRepo, incidentId, user);
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");

  const existing = await assignmentRepo.get(incidentId, channelId);
  if (!existing || existing.agencyId !== user.agencyId) throw new Error("ASSIGNMENT_NOT_FOUND");

  await assignmentRepo.remove(incidentId, channelId);
}
