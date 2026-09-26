/**
 * Phase 1 trust lifecycle, mounted at /api/agencies/{agencyId}/network/*.
 * agencyId comes from the verified session. rcsuperadmin may target the path agency.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  acceptInviteRequestSchema,
  isRcsuperadmin,
  revokeRelationshipSchema,
  sendInviteRequestSchema,
  suspendRelationshipSchema,
  updatePolicyRequestSchema,
  writebackApprovalSchema,
  writebackToggleSchema,
  type AgencySharingPolicy,
  type ShareFieldPolicy,
  type UserContext,
  type WritebackFieldPolicy,
} from 'rapid-cortex-shared';
import { AUDIT_EVENT_TYPES, AuthorizationService, type Permission } from 'rapid-cortex-security';
import { AgencyRepository } from '../repositories/agencyRepository.js';
import { AuditRepository } from '../repositories/auditRepository.js';
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from '../lib/auth.js';
import { withCorrelationHeaders } from '../lib/correlation.js';
import { env } from '../lib/env.js';
import { makeId } from '../lib/ids.js';
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  ok,
  unauthorized,
} from '../lib/response.js';
import { performCADWriteback } from './share-delivery';
import {
  AuditKeys,
  AuditRepo,
  PolicyRepo,
  SharedIncidentRepo,
  TrustRepo,
  ensureDeliveryQueue,
} from './tables';

const authz = new AuthorizationService();
const agencies = new AgencyRepository();
const platformAudit = new AuditRepository();

type Actor = { agencyId: string; userId: string; user: UserContext };

function pathAgencyId(event: APIGatewayProxyEventV2): string | undefined {
  const raw = event.rawPath || event.requestContext.http.path;
  const match = raw.match(/\/api\/agencies\/([^/]+)\/network(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function tail(event: APIGatewayProxyEventV2): string[] {
  const raw = event.rawPath || event.requestContext.http.path;
  const match = raw.match(/\/network(?:\/(.*))?$/);
  return (match?.[1] ?? '').split('/').filter(Boolean).map(decodeURIComponent);
}

async function actorFrom(event: APIGatewayProxyEventV2): Promise<Actor | APIGatewayProxyResultV2> {
  if (!env.cadMeshEnabled) return notFound('CAD mesh is disabled');
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return forbidden(ACCOUNT_INACTIVE_MESSAGE);
  const requested = pathAgencyId(event);
  let agencyId = user.agencyId;
  if (requested && requested !== user.agencyId) {
    if (!isRcsuperadmin(user)) return forbidden('Agency scope does not match the session');
    agencyId = requested;
  }
  return { agencyId, userId: user.userId, user };
}

function isResult(value: Actor | APIGatewayProxyResultV2): value is APIGatewayProxyResultV2 {
  return typeof value === 'object' && value !== null && 'statusCode' in value;
}

function can(user: UserContext, permission: Permission): boolean {
  return authz.canPerform(user, permission);
}

function canView(user: UserContext): boolean {
  return can(user, 'incidents.view') || can(user, 'integrations.view') || can(user, 'cad.incidents.view');
}

async function audit(agencyId: string, userId: string, type: string, details: Record<string, unknown>): Promise<void> {
  try {
    await platformAudit.create({
      eventId: makeId('audit'),
      agencyId,
      actorId: userId,
      type,
      details,
      createdAt: new Date().toISOString(),
      resourceType: 'integration',
      resourceId: typeof details.partnerAgencyId === 'string' ? details.partnerAgencyId : agencyId,
    });
  } catch (e) {
    console.warn('[CAD-MESH] audit write failed', e);
  }
}

async function provisionQueues(...agencyIds: string[]): Promise<void> {
  await Promise.all(agencyIds.map(async (agencyId) => {
    try {
      await ensureDeliveryQueue(agencyId);
    } catch (e) {
      console.warn(`[CAD-MESH] delivery queue provision failed for ${agencyId}`, e);
    }
  }));
}

async function sendInvite(event: APIGatewayProxyEventV2, actor: Actor): Promise<APIGatewayProxyResultV2> {
  if (!can(actor.user, 'integrations.manage')) return forbidden('Insufficient permissions to send partnership invites');
  let raw: unknown = {};
  if (event.body) {
    try { raw = JSON.parse(event.body); } catch { return badRequest('Invalid JSON'); }
  }
  const parsed = sendInviteRequestSchema.safeParse(raw);
  if (!parsed.success) return badRequestFromZod(parsed.error);
  const body = parsed.data;
  if (body.partnerAgencyId === actor.agencyId) return badRequest('Cannot invite your own agency');

  const existing = await TrustRepo.get(actor.agencyId, body.partnerAgencyId);
  if (existing && existing.status !== 'revoked') {
    return conflict(`Relationship already exists with status: ${existing.status}`);
  }

  const [self, partner] = await Promise.all([
    agencies.get(actor.agencyId),
    agencies.get(body.partnerAgencyId),
  ]);
  if (!partner) return notFound('Partner agency not found');

  const now = new Date().toISOString();
  await TrustRepo.createBilateral({
    agencyId: actor.agencyId,
    agencyName: self?.name ?? actor.agencyId,
    partnerAgencyId: body.partnerAgencyId,
    partnerAgencyName: partner.name,
    status: 'pending_initiator',
    initiatedBy: actor.agencyId,
    initiatedByUserId: actor.userId,
    inviteMessage: body.inviteMessage,
    mouVersion: body.mouVersion,
    initiatorMouSignedAt: now,
    initiatorMouSignedBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  });
  await provisionQueues(actor.agencyId, body.partnerAgencyId);
  await audit(actor.agencyId, actor.userId, AUDIT_EVENT_TYPES.CAD_MESH_INVITE_SENT, {
    partnerAgencyId: body.partnerAgencyId,
    mouVersion: body.mouVersion,
  });
  return ok({ message: 'Invite sent successfully', partnerAgencyId: body.partnerAgencyId }, 201);
}

async function acceptInvite(event: APIGatewayProxyEventV2, actor: Actor, partnerAgencyId: string): Promise<APIGatewayProxyResultV2> {
  if (!can(actor.user, 'integrations.manage')) return forbidden('Only agency administrators can accept partnership invites');
  const parsed = acceptInviteRequestSchema.safeParse(event.body ? JSON.parse(event.body) : {});
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const trust = await TrustRepo.get(actor.agencyId, partnerAgencyId);
  if (!trust) return notFound('No pending invite found');
  if (trust.status !== 'pending_acceptor') return conflict(`Cannot accept invite with status: ${trust.status}`);
  if (trust.mouVersion !== parsed.data.mouVersion) return conflict('MOU version mismatch — refresh and re-accept');

  const now = new Date().toISOString();
  await TrustRepo.updateStatusBilateral(actor.agencyId, partnerAgencyId, 'active', {
    acceptorMouSignedAt: now,
    acceptorMouSignedBy: actor.userId,
    activatedAt: now,
  });
  await Promise.all([
    PolicyRepo.upsert(PolicyRepo.defaultPolicy(actor.agencyId, partnerAgencyId, actor.userId)),
    PolicyRepo.upsert(PolicyRepo.defaultPolicy(partnerAgencyId, actor.agencyId, actor.userId)),
  ]);
  await provisionQueues(actor.agencyId, partnerAgencyId);
  await audit(actor.agencyId, actor.userId, AUDIT_EVENT_TYPES.CAD_MESH_INVITE_ACCEPTED, { partnerAgencyId });
  return ok({ message: 'Partnership activated', activatedAt: now });
}

async function revokeRelationship(event: APIGatewayProxyEventV2, actor: Actor, partnerAgencyId: string): Promise<APIGatewayProxyResultV2> {
  if (!can(actor.user, 'integrations.manage')) return forbidden('Only agency administrators can revoke partnerships');
  let raw: unknown = {};
  if (event.body) {
    try { raw = JSON.parse(event.body); } catch { return badRequest('Invalid JSON'); }
  }
  const parsed = revokeRelationshipSchema.safeParse(raw);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const trust = await TrustRepo.get(actor.agencyId, partnerAgencyId);
  if (!trust) return notFound('Relationship not found');
  if (trust.status === 'revoked') return conflict('Relationship already revoked');

  const now = new Date().toISOString();
  await TrustRepo.updateStatusBilateral(actor.agencyId, partnerAgencyId, 'revoked', {
    revokedAt: now,
    revokedBy: actor.userId,
    revokedReason: parsed.data.reason ?? 'No reason provided',
  });
  const [policyA, policyB] = await Promise.all([
    PolicyRepo.get(actor.agencyId, partnerAgencyId),
    PolicyRepo.get(partnerAgencyId, actor.agencyId),
  ]);
  if (policyA) await PolicyRepo.upsert({ ...policyA, enabled: false, updatedAt: now, updatedBy: actor.userId });
  if (policyB) await PolicyRepo.upsert({ ...policyB, enabled: false, updatedAt: now, updatedBy: actor.userId });
  await audit(actor.agencyId, actor.userId, AUDIT_EVENT_TYPES.CAD_MESH_RELATIONSHIP_REVOKED, {
    partnerAgencyId,
    reason: parsed.data.reason,
  });
  return ok({ message: 'Partnership revoked', revokedAt: now });
}

async function suspendRelationship(event: APIGatewayProxyEventV2, actor: Actor, partnerAgencyId: string): Promise<APIGatewayProxyResultV2> {
  if (!can(actor.user, 'integrations.manage')) return forbidden('Insufficient permissions');
  let raw: unknown;
  try { raw = event.body ? JSON.parse(event.body) : null; } catch { return badRequest('Invalid JSON'); }
  const parsed = suspendRelationshipSchema.safeParse(raw);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const trust = await TrustRepo.get(actor.agencyId, partnerAgencyId);
  if (!trust) return notFound('Relationship not found');
  if (parsed.data.suspend && trust.status !== 'active') {
    return conflict(`Cannot suspend a relationship with status: ${trust.status}`);
  }
  if (!parsed.data.suspend && trust.status !== 'suspended') {
    return conflict(`Cannot resume a relationship with status: ${trust.status}`);
  }

  const now = new Date().toISOString();
  const newStatus = parsed.data.suspend ? 'suspended' : 'active';
  await TrustRepo.updateStatusBilateral(actor.agencyId, partnerAgencyId, newStatus, parsed.data.suspend
    ? { suspendedAt: now, suspendedBy: actor.userId, suspendedReason: parsed.data.reason }
    : {});
  await audit(
    actor.agencyId,
    actor.userId,
    parsed.data.suspend ? AUDIT_EVENT_TYPES.CAD_MESH_RELATIONSHIP_SUSPENDED : AUDIT_EVENT_TYPES.CAD_MESH_RELATIONSHIP_RESUMED,
    { partnerAgencyId },
  );
  return ok({ message: `Partnership ${parsed.data.suspend ? 'suspended' : 'resumed'}`, updatedAt: now });
}

async function listRelationships(actor: Actor): Promise<APIGatewayProxyResultV2> {
  if (!canView(actor.user)) return forbidden('Insufficient permissions');
  const [relationships, policies] = await Promise.all([
    TrustRepo.listByAgency(actor.agencyId),
    PolicyRepo.listByAgency(actor.agencyId),
  ]);
  const policyMap = new Map(policies.map((policy) => [policy.partnerAgencyId, policy]));
  const enriched = relationships.map((relationship) => ({
    ...relationship,
    policy: policyMap.get(relationship.partnerAgencyId) ?? null,
  }));
  return ok({ relationships: enriched, total: enriched.length });
}

async function updatePolicy(event: APIGatewayProxyEventV2, actor: Actor, partnerAgencyId: string): Promise<APIGatewayProxyResultV2> {
  if (!can(actor.user, 'integrations.manage')) return forbidden('Insufficient permissions');
  const trust = await TrustRepo.get(actor.agencyId, partnerAgencyId);
  if (!trust || trust.status !== 'active') return notFound('No active relationship with this partner');

  let raw: unknown;
  try { raw = event.body ? JSON.parse(event.body) : null; } catch { return badRequest('Invalid JSON'); }
  const parsed = updatePolicyRequestSchema.safeParse(raw);
  if (!parsed.success) return badRequestFromZod(parsed.error);
  if (parsed.data.writebackEnabled === true && !env.cadWritebackEnabled) {
    return forbidden('CAD write-back is disabled for this environment');
  }

  const existing = await PolicyRepo.get(actor.agencyId, partnerAgencyId);
  if (!existing) return notFound('Policy not found — relationship may still be activating');

  const now = new Date().toISOString();
  const updates = parsed.data;
  const {
    shareIncidentTypes,
    shareFields,
    writebackFields,
    geoBoundaryMiles,
    hqLat,
    hqLon,
    ...rest
  } = updates;
  const updated: AgencySharingPolicy = {
    ...existing,
    ...rest,
    shareIncidentTypes: (shareIncidentTypes as AgencySharingPolicy['shareIncidentTypes'] | undefined) ?? existing.shareIncidentTypes,
    geoBoundaryMiles: geoBoundaryMiles === null ? undefined : geoBoundaryMiles ?? existing.geoBoundaryMiles,
    hqLat: hqLat === null ? undefined : hqLat ?? existing.hqLat,
    hqLon: hqLon === null ? undefined : hqLon ?? existing.hqLon,
    shareFields: { ...existing.shareFields, ...(shareFields ?? {}) } as ShareFieldPolicy,
    writebackFields: { ...existing.writebackFields, ...(writebackFields ?? {}) } as WritebackFieldPolicy,
    updatedAt: now,
    updatedBy: actor.userId,
  };
  await PolicyRepo.upsert(updated);
  await audit(actor.agencyId, actor.userId, AUDIT_EVENT_TYPES.CAD_MESH_POLICY_UPDATED, { partnerAgencyId });
  return ok({ policy: updated });
}

async function toggleWriteback(event: APIGatewayProxyEventV2, actor: Actor, partnerAgencyId: string): Promise<APIGatewayProxyResultV2> {
  if (!can(actor.user, 'integrations.manage')) return forbidden('Only agency administrators can toggle CAD write-back');
  let raw: unknown;
  try { raw = event.body ? JSON.parse(event.body) : null; } catch { return badRequest('Invalid JSON'); }
  const parsed = writebackToggleSchema.safeParse(raw);
  if (!parsed.success) return badRequestFromZod(parsed.error);
  if (parsed.data.enabled && !env.cadWritebackEnabled) {
    return forbidden('CAD write-back is disabled for this environment');
  }

  const policy = await PolicyRepo.get(actor.agencyId, partnerAgencyId);
  if (!policy) return notFound('Policy not found');
  const now = new Date().toISOString();
  const updated: AgencySharingPolicy = {
    ...policy,
    writebackEnabled: parsed.data.enabled,
    writebackMode: parsed.data.mode ?? policy.writebackMode ?? 'assisted',
    updatedAt: now,
    updatedBy: actor.userId,
  };
  await PolicyRepo.upsert(updated);
  await audit(actor.agencyId, actor.userId, AUDIT_EVENT_TYPES.CAD_MESH_WRITEBACK_TOGGLED, {
    partnerAgencyId,
    writebackEnabled: updated.writebackEnabled,
    writebackMode: updated.writebackMode,
  });
  return ok({
    writebackEnabled: updated.writebackEnabled,
    writebackMode: updated.writebackMode,
    message: parsed.data.enabled
      ? `CAD write-back enabled in ${updated.writebackMode} mode`
      : 'CAD write-back disabled',
  });
}

async function approveWriteback(event: APIGatewayProxyEventV2, actor: Actor): Promise<APIGatewayProxyResultV2> {
  let raw: unknown;
  try { raw = event.body ? JSON.parse(event.body) : null; } catch { return badRequest('Invalid JSON'); }
  const parsed = writebackApprovalSchema.safeParse(raw);
  if (!parsed.success) return badRequestFromZod(parsed.error);
  const { shareId, approved, reason } = parsed.data;
  const permission = approved ? 'cad.writeback.approve' : 'cad.writeback.reject';
  if (!can(actor.user, permission)) return forbidden('Insufficient permissions to decide CAD write-back');
  if (approved && !env.cadWritebackEnabled) return forbidden('CAD write-back is disabled for this environment');

  const incident = await SharedIncidentRepo.getByShareId(actor.agencyId, shareId);
  if (!incident) return notFound('Shared incident not found');
  if (incident.writebackStatus !== 'pending') return conflict(`Writeback already ${incident.writebackStatus}`);

  const now = new Date().toISOString();
  if (approved) {
    await SharedIncidentRepo.updateWritebackStatus(actor.agencyId, incident.sk, 'approved', {
      writebackApprovedBy: actor.userId,
    });
  } else {
    await SharedIncidentRepo.updateWritebackStatus(actor.agencyId, incident.sk, 'rejected', {
      writebackRejectedReason: reason,
      writebackRejectedBy: actor.userId,
    });
  }
  await AuditRepo.write({
    pk: AuditKeys.pk(actor.agencyId),
    sk: AuditKeys.sk(now, shareId),
    shareId,
    direction: 'inbound',
    sourceAgencyId: incident.sourceAgencyId,
    receiverAgencyId: actor.agencyId,
    incidentId: incident.incidentId,
    policySnapshot: {
      sharingMode: 'manual',
      shareFields: {
        location: false,
        incidentType: false,
        priority: false,
        unitStatus: false,
        narrative: false,
        aiSummary: false,
        transcript: false,
        confidenceScore: false,
        extractedEntities: false,
      },
      shareIncidentTypes: [],
    },
    fieldsShared: [],
    deliveryStatus: 'delivered',
    writebackStatus: approved ? 'approved' : 'rejected',
    triggeredBy: 'manual',
    userId: actor.userId,
    timestamp: now,
  });
  await audit(actor.agencyId, actor.userId, AUDIT_EVENT_TYPES.CAD_MESH_WRITEBACK_DECIDED, {
    shareId,
    approved,
    partnerAgencyId: incident.sourceAgencyId,
  });
  if (approved) {
    await performCADWriteback({ ...incident, writebackStatus: 'approved', writebackApprovedBy: actor.userId });
  }
  return ok({ message: approved ? 'Write-back approved' : 'Write-back rejected', shareId });
}

async function listSharedIncidents(event: APIGatewayProxyEventV2, actor: Actor): Promise<APIGatewayProxyResultV2> {
  if (!canView(actor.user)) return forbidden('Insufficient permissions');
  const requested = Number(event.queryStringParameters?.limit ?? '50');
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 50;
  const incidents = await SharedIncidentRepo.list(actor.agencyId, limit);
  return ok({ incidents, total: incidents.length });
}

async function route(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const actor = await actorFrom(event);
  if (isResult(actor)) return actor;
  const method = event.requestContext.http.method.toUpperCase();
  const parts = tail(event);

  try {
    if (parts.length === 0 && method === 'GET') return await listRelationships(actor);
    if (parts.length === 1 && parts[0] === 'invite' && method === 'POST') return await sendInvite(event, actor);
    if (parts.length === 1 && parts[0] === 'shared-incidents' && method === 'GET') {
      return await listSharedIncidents(event, actor);
    }
    if (parts.length === 1 && parts[0] === 'writeback-approve' && method === 'PUT') {
      return await approveWriteback(event, actor);
    }
    if (parts.length === 2) {
      const [partnerAgencyId, action] = parts;
      if (!partnerAgencyId) return badRequest('Missing partner');
      if (action === 'accept' && method === 'PUT') return await acceptInvite(event, actor, partnerAgencyId);
      if (action === 'suspend' && method === 'PUT') return await suspendRelationship(event, actor, partnerAgencyId);
      if (action === 'policy' && method === 'PUT') return await updatePolicy(event, actor, partnerAgencyId);
      if (action === 'writeback-toggle' && method === 'PUT') return await toggleWriteback(event, actor, partnerAgencyId);
    }
    if (parts.length === 1 && method === 'DELETE') return await revokeRelationship(event, actor, parts[0]!);
    return notFound('Route not found');
  } catch (e) {
    console.error('[CAD-MESH] request failed', e);
    return ok({ error: 'Internal server error' }, 500);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  return withCorrelationHeaders(event, await route(event));
};
