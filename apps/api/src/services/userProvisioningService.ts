import type { CreateInviteInput, InviteRecord, UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { InviteRepository } from "../repositories/inviteRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const invites = new InviteRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

/**
 * User invitations and future Cognito orchestration — Dynamo invite ledger in v1.
 */
export class UserProvisioningService {
  async listInvites(user: UserContext, agencyId: string): Promise<InviteRecord[]> {
    if (!authz.canCreateInvite(user, agencyId)) throw new Error("FORBIDDEN");
    return invites.listByAgency(agencyId);
  }

  async createInvite(
    user: UserContext,
    agencyId: string,
    input: CreateInviteInput,
  ): Promise<InviteRecord> {
    if (!authz.canCreateInvite(user, agencyId)) throw new Error("FORBIDDEN");
    authz.assertAssignableAgencyRole(input.role);
    const now = new Date().toISOString();
    const ttlDays = input.expiresInDays ?? 14;
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
    const invite: InviteRecord = {
      inviteId: makeId("inv"),
      agencyId,
      email: input.email.toLowerCase(),
      role: input.role,
      invitedByUserId: user.userId,
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    await invites.put(invite);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INVITE_CREATED,
      details: { inviteId: invite.inviteId, email: invite.email, role: invite.role },
      createdAt: now,
      resourceType: "user",
      resourceId: invite.inviteId,
    });
    return invite;
  }
}
