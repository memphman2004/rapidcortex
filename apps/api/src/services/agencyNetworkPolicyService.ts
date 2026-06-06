import { randomUUID } from "node:crypto";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  type AccessCheckResult,
  type AddNetworkCidrBody,
  type AgencyNetworkPolicy,
  type AgencyTenant,
  type EmergencyOverrideRequestBody,
  type GrantEmergencyOverrideBody,
  defaultAgencyNetworkPolicy,
  hasEnabledScheduleDay,
  isValidCidr,
  validateShiftSchedule,
  type PatchAgencyNetworkPolicyBody,
  type UserContext,
} from "rapid-cortex-shared";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AgencyScopeResolver } from "rapid-cortex-security";
import { evaluateNetworkAccess } from "../middleware/network-access.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { NetworkEmergencyOverrideRepository } from "../repositories/networkEmergencyOverrideRepository.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import {
  sendEmergencyOverrideGrantedEmail,
  sendEmergencyOverrideRequestEmail,
} from "./networkAccessEmailService.js";

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const overrideRepo = new NetworkEmergencyOverrideRepository();
const sns = new SNSClient({ region: env.region });

function nowIso(): string {
  return new Date().toISOString();
}

function assertView(user: UserContext, agencyId: string): void {
  AgencyScopeResolver.assertCanReadAgencyProfile(user, agencyId);
  if (!defaultPermissionForRole(user.role, "system.settings_view")) {
    throw new Error("FORBIDDEN");
  }
}

function assertEdit(user: UserContext, agencyId: string): void {
  AgencyScopeResolver.assertCanReadAgencyProfile(user, agencyId);
  if (!defaultPermissionForRole(user.role, "system.settings_edit")) {
    throw new Error("FORBIDDEN");
  }
}

async function publishWafSync(agencyId: string): Promise<void> {
  const arn = env.agencyNetworkPolicySnsTopicArn;
  if (!arn) return;
  await sns.send(
    new PublishCommand({
      TopicArn: arn,
      Message: JSON.stringify({ agencyId }),
    }),
  );
}

function mergePolicy(
  current: AgencyNetworkPolicy,
  patch: PatchAgencyNetworkPolicyBody,
  actor: UserContext,
): AgencyNetworkPolicy {
  const now = nowIso();
  const next: AgencyNetworkPolicy = {
    ...current,
    ...patch,
    lastUpdatedAt: now,
    lastUpdatedBy: actor.email ?? actor.userId,
    wafSyncStatus: "syncing",
  };
  if (patch.shiftSchedule) next.shiftSchedule = patch.shiftSchedule;
  return next;
}

export class AgencyNetworkPolicyService {
  async getPolicy(agencyId: string, user: UserContext) {
    assertView(user, agencyId);
    const agency = await agencyRepo.get(agencyId);
    if (!agency) throw new Error("NOT_FOUND");
    const policy = agency.networkPolicy ?? defaultAgencyNetworkPolicy();
    return {
      policy,
      wafSyncStatus: policy.wafSyncStatus ?? "not_configured",
    };
  }

  async patchPolicy(agencyId: string, user: UserContext, body: PatchAgencyNetworkPolicyBody) {
    assertEdit(user, agencyId);
    const agency = await agencyRepo.get(agencyId);
    if (!agency) throw new Error("NOT_FOUND");
    const current = agency.networkPolicy ?? defaultAgencyNetworkPolicy(user.email);
    const next = mergePolicy(current, body, user);

    if (next.ipAllowlistEnabled && next.allowedCidrs.length === 0) {
      throw new Error("IP_ALLOWLIST_EMPTY");
    }
    if (next.timeRestrictionEnabled) {
      if (!next.shiftSchedule || !hasEnabledScheduleDay(next.shiftSchedule)) {
        throw new Error("TIME_SCHEDULE_EMPTY");
      }
      const errs = validateShiftSchedule(next.shiftSchedule);
      if (errs.length) throw new Error(`SCHEDULE_INVALID:${errs.join(";")}`);
    }

    await this.savePolicy(agency, next, user, AUDIT_EVENT_TYPES.NETWORK_POLICY_UPDATED);
    await publishWafSync(agencyId);
    return next;
  }

  async addCidr(agencyId: string, user: UserContext, body: AddNetworkCidrBody) {
    assertEdit(user, agencyId);
    if (!isValidCidr(body.cidr)) throw new Error("INVALID_CIDR");
    const agency = await agencyRepo.get(agencyId);
    if (!agency) throw new Error("NOT_FOUND");
    const current = agency.networkPolicy ?? defaultAgencyNetworkPolicy(user.email);
    if (current.allowedCidrs.length >= 50) throw new Error("CIDR_LIMIT");
    const next: AgencyNetworkPolicy = {
      ...current,
      allowedCidrs: [
        ...current.allowedCidrs,
        {
          cidr: body.cidr.trim(),
          label: body.label.trim(),
          addedAt: nowIso(),
          addedBy: user.email ?? user.userId,
        },
      ],
      lastUpdatedAt: nowIso(),
      lastUpdatedBy: user.email ?? user.userId,
      wafSyncStatus: "syncing",
    };
    await this.savePolicy(agency, next, user, AUDIT_EVENT_TYPES.NETWORK_POLICY_UPDATED);
    await publishWafSync(agencyId);
    return next;
  }

  async removeCidr(agencyId: string, user: UserContext, encodedCidr: string) {
    assertEdit(user, agencyId);
    const cidr = decodeURIComponent(encodedCidr);
    const agency = await agencyRepo.get(agencyId);
    if (!agency) throw new Error("NOT_FOUND");
    const current = agency.networkPolicy ?? defaultAgencyNetworkPolicy(user.email);
    if (current.ipAllowlistEnabled && current.allowedCidrs.length <= 1) {
      throw new Error("LAST_CIDR");
    }
    const next: AgencyNetworkPolicy = {
      ...current,
      allowedCidrs: current.allowedCidrs.filter((e) => e.cidr !== cidr),
      lastUpdatedAt: nowIso(),
      lastUpdatedBy: user.email ?? user.userId,
      wafSyncStatus: "syncing",
    };
    await this.savePolicy(agency, next, user, AUDIT_EVENT_TYPES.NETWORK_POLICY_UPDATED);
    await publishWafSync(agencyId);
    return next;
  }

  async grantEmergencyOverride(agencyId: string, user: UserContext, body: GrantEmergencyOverrideBody) {
    AgencyScopeResolver.assertCanReadAgencyProfile(user, agencyId);
    const agency = await agencyRepo.get(agencyId);
    if (!agency) throw new Error("NOT_FOUND");
    const policy = agency.networkPolicy ?? defaultAgencyNetworkPolicy();
    if (!policy.allowEmergencyOverride) throw new Error("OVERRIDE_DISABLED");
    const canGrant =
      user.role === "rcsuperadmin" ||
      user.role === "rcadmin" ||
      user.role === "agencyadmin" ||
      user.role === "agencyit";
    if (!canGrant) throw new Error("FORBIDDEN");

    const grantedAt = nowIso();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const tokenId = randomUUID();
    await overrideRepo.putToken({
      tokenId,
      agencyId,
      userId: body.userId,
      grantedBy: user.email ?? user.userId,
      grantedAt,
      expiresAt,
      reason: body.reason,
      used: false,
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.NETWORK_EMERGENCY_OVERRIDE_GRANTED,
      details: { tokenId, targetUserId: body.userId, reason: body.reason },
      createdAt: grantedAt,
      resourceType: "network_emergency_override",
      resourceId: tokenId,
    });
    const notifyEmail = body.userId.includes("@")
      ? body.userId
      : (agency.primaryContactEmail?.trim() ?? "");
    if (notifyEmail) {
      void sendEmergencyOverrideGrantedEmail({
        agency,
        targetEmail: notifyEmail,
        reason: body.reason,
        expiresAt,
      }).catch(() => undefined);
    }
    return { tokenId, expiresAt, message: "Emergency access granted for 4 hours (single use)." };
  }

  async requestEmergencyOverride(user: UserContext, body: EmergencyOverrideRequestBody) {
    const agency = await agencyRepo.get(user.agencyId);
    if (!agency) throw new Error("NOT_FOUND");
    const policy = agency.networkPolicy ?? defaultAgencyNetworkPolicy();
    if (!policy.allowEmergencyOverride) throw new Error("OVERRIDE_DISABLED");
    const requestId = randomUUID();
    const now = nowIso();
    await overrideRepo.putRequest({
      userId: user.userId,
      sortKey: `REQUEST#${requestId}`,
      recordType: "request",
      tokenId: requestId,
      agencyId: user.agencyId,
      grantedAt: now,
      createdAt: now,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      reason: body.reason,
      used: false,
      status: "pending",
      ttl: Math.floor(Date.now() / 1000) + 7 * 86_400,
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.NETWORK_EMERGENCY_OVERRIDE_REQUESTED,
      details: { requestId, reason: body.reason },
      createdAt: now,
      resourceType: "network_emergency_override_request",
      resourceId: requestId,
    });
    void sendEmergencyOverrideRequestEmail({
      agency,
      requesterName: user.displayName ?? user.email ?? user.userId,
      requesterEmail: user.email,
      reason: body.reason,
      requestId,
    }).catch(() => undefined);
    return { requestId, status: "pending" as const };
  }

  async checkAccess(
    event: Parameters<typeof evaluateNetworkAccess>[0],
    user: UserContext,
  ): Promise<AccessCheckResult> {
    return evaluateNetworkAccess(event, user);
  }

  async listAudit(agencyId: string, user: UserContext, limit = 100) {
    assertView(user, agencyId);
    if (!defaultPermissionForRole(user.role, "audit.view")) throw new Error("FORBIDDEN");
    const items = await auditRepo.listByAgency(agencyId, limit);
    return items.filter((e) => typeof e.type === "string" && e.type.startsWith("network."));
  }

  private async savePolicy(
    agency: AgencyTenant,
    policy: AgencyNetworkPolicy,
    user: UserContext,
    auditType: string,
  ): Promise<void> {
    const updated: AgencyTenant = {
      ...agency,
      networkPolicy: policy,
      updatedAt: nowIso(),
    };
    await agencyRepo.put(updated);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: agency.agencyId,
      actorId: user.userId,
      type: auditType,
      details: {
        ipAllowlistEnabled: policy.ipAllowlistEnabled,
        timeRestrictionEnabled: policy.timeRestrictionEnabled,
      },
      createdAt: policy.lastUpdatedAt,
      resourceType: "network_policy",
      resourceId: agency.agencyId,
    });
  }
}
