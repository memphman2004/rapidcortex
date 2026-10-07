import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { z } from "zod";
import { isRcsuperadmin } from "rapid-cortex-shared";
import type { AuditEvent, UserContext } from "rapid-cortex-shared";
import { assertGrantWithinAuthority, extractDashboardPrefix } from "../lib/accessOverrideGrantPolicy.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { AccessOverrideRepository } from "../repositories/accessOverrideRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import type {
  AccessOverrideRecord,
  AccessOverrideStatus,
  AccessOverrideType,
} from "../types/accessOverride.js";

const repo = new AccessOverrideRepository();
const auditRepo = new AuditRepository();

const grantBodySchema = z.object({
  targetUserId: z.string().min(3),
  overrideType: z.enum(["role", "permission", "feature", "incident-access"]),
  grantedRoleOrPermission: z.string().min(2),
  reason: z.string().min(4),
  /** ISO-8601 end time; empty means no expiration. */
  expiresAt: z.string().optional().nullable(),
  /** Only honored for RC Admin (`rcsuperadmin`); never trust for agency admins. */
  agencyId: z.string().min(1).optional(),
});

const revokeBodySchema = z.object({
  reason: z.string().min(4),
});

function attr(attrs: AttributeType[] | undefined, name: string): string {
  const a = attrs?.find((x) => x.Name === name);
  return String(a?.Value ?? "").trim();
}

function cip() {
  return new CognitoIdentityProviderClient({ region: env.region });
}

export type ResolvedCognitoUser = {
  /** Pool username suitable for AdminUpdateUser */
  cognitoUsername: string;
  sub: string;
  email: string;
  name: string;
  agencyId: string;
};

async function resolveCognitoUser(targetUserId: string): Promise<ResolvedCognitoUser | null> {
  const pool = env.cognitoUserPoolId;
  if (!pool) return null;
  try {
    const out = await cip().send(
      new AdminGetUserCommand({ UserPoolId: pool, Username: targetUserId }),
    );
    const attrs = out.UserAttributes;
    const sub = attr(attrs, "sub") || "";
    const email = attr(attrs, "email") || "";
    const name =
      `${attr(attrs, "given_name")} ${attr(attrs, "family_name")}`.trim() ||
      attr(attrs, "name") ||
      email;
    return {
      cognitoUsername: String(out.Username ?? targetUserId),
      sub,
      email: email || attr(attrs, "preferred_username"),
      name,
      agencyId: attr(attrs, "custom:agencyId"),
    };
  } catch {
    // continue
  }
  try {
    const out = await cip().send(
      new ListUsersCommand({
        UserPoolId: pool,
        Filter: `sub = "${targetUserId}"`,
        Limit: 1,
      }),
    );
    const u = out.Users?.[0];
    if (!u) return null;
    const attrs = u.Attributes;
    return {
      cognitoUsername: String(u.Username ?? ""),
      sub: attr(attrs, "sub"),
      email: attr(attrs, "email") || "",
      name:
        `${attr(attrs, "given_name")} ${attr(attrs, "family_name")}`.trim() ||
        attr(attrs, "name") ||
        "",
      agencyId: attr(attrs, "custom:agencyId"),
    };
  } catch {
    return null;
  }
}

function effectiveStatus(record: AccessOverrideRecord, at = Date.now()): AccessOverrideStatus {
  if (record.status === "revoked") return "revoked";
  if (record.expiresAt && Date.parse(record.expiresAt) <= at) return "expired";
  return "active";
}

function assertManageAccess(actor: UserContext): void {
  if (actor.role !== "agencyadmin" && !isRcsuperadmin(actor)) throw new Error("FORBIDDEN");
}

function actorAgency(actor: UserContext, queryAgencyId: string | undefined): string {
  if (isRcsuperadmin(actor)) {
    const a = queryAgencyId?.trim();
    if (!a) throw new Error("AGENCY_REQUIRED");
    return a;
  }
  return actor.agencyId;
}

function deriveDashboardCsvForUser(
  records: AccessOverrideRecord[],
): string {
  const at = Date.now();
  const prefixSet = new Set<string>();
  for (const r of records) {
    if (effectiveStatus(r, at) !== "active") continue;
    if (r.overrideType !== "permission") continue;
    const p = extractDashboardPrefix(r.grantedRoleOrPermission);
    if (p) prefixSet.add(p);
  }
  return [...prefixSet].sort().join(",");
}

async function syncCognitoDashboardAccessFromOverrides(
  target: ResolvedCognitoUser,
  agencyId: string,
): Promise<void> {
  const pool = env.cognitoUserPoolId;
  if (!pool) return;
  const key = target.sub || target.email;
  if (!key) return;
  const rows = await repo.queryByAgencyAndTargetUser(agencyId, key);
  const csv = deriveDashboardCsvForRows(rows);

  await cip().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: pool,
      Username: target.cognitoUsername,
      UserAttributes: [{ Name: "custom:dashboardAccess", Value: csv }],
    }),
  );
}

function deriveDashboardCsvForRows(records: AccessOverrideRecord[]): string {
  const at = Date.now();
  const prefixSet = new Set<string>();
  for (const r of records) {
    if (effectiveStatus(r, at) !== "active") continue;
    if (r.overrideType !== "permission") continue;
    const p = extractDashboardPrefix(r.grantedRoleOrPermission);
    if (p) prefixSet.add(p);
  }
  return [...prefixSet].sort().join(",");
}

function requestMeta(event: APIGatewayProxyEventV2) {
  const requestId =
    event.requestContext?.requestId ??
    (event.headers as Record<string, string | undefined>)["x-amzn-requestid"] ??
    (event.headers as Record<string, string | undefined>)["x-request-id"] ??
    "unknown";
  const ua =
    event.headers?.["user-agent"] ?? event.headers?.["User-Agent"] ?? undefined;
  const ip =
    (event.requestContext as { http?: { sourceIp?: string } })?.http?.sourceIp ?? undefined;
  return { requestId, ip, userAgent: ua };
}

function auditPayload(base: {
  eventType: "access.override.granted" | "access.override.revoked";
  agencyId: string;
  actor: UserContext;
  targetUserId: string;
  overrideId: string;
  action: "grant" | "revoke";
  reason: string;
  before?: unknown;
  after?: unknown;
  meta: ReturnType<typeof requestMeta>;
}): AuditEvent {
  const now = new Date().toISOString();
  return {
    eventId: makeId("audit"),
    agencyId: base.agencyId,
    actorId: base.actor.userId,
    type: base.eventType,
    details: {
      eventType:
        base.eventType === "access.override.granted"
          ? "ACCESS_OVERRIDE_GRANTED"
          : "ACCESS_OVERRIDE_REVOKED",
      actorRole: base.actor.role,
      actorEmail: base.actor.email,
      targetUserId: base.targetUserId,
      overrideId: base.overrideId,
      action: base.action,
      reason: base.reason,
      before: base.before ?? null,
      after: base.after ?? null,
      requestId: base.meta.requestId,
    },
    createdAt: now,
    resourceType: "user",
    resourceId: base.targetUserId,
    ip: base.meta.ip,
    userAgent: base.meta.userAgent,
  };
}

export class AccessOverrideService {
  async list(
    actor: UserContext,
    query: { agencyId?: string | null; status?: string | null; search?: string | null },
  ): Promise<{ items: Array<AccessOverrideRecord & { effectiveStatus: AccessOverrideStatus }> }> {
    assertManageAccess(actor);
    const agency = actorAgency(actor, query.agencyId?.trim() ?? undefined);
    const rows = await repo.queryByAgency(agency, 1000);
    const at = Date.now();
    let mapped = rows.map((r) => ({
      ...r,
      effectiveStatus: effectiveStatus(r, at),
    }));
    const st = query.status?.trim().toLowerCase();
    if (st && st !== "all") {
      mapped = mapped.filter((m) => m.effectiveStatus === st);
    }
    const q = query.search?.trim().toLowerCase();
    if (q) {
      mapped = mapped.filter(
        (m) =>
          m.targetUserEmail.toLowerCase().includes(q) ||
          m.targetUserId.toLowerCase().includes(q) ||
          m.grantedRoleOrPermission.toLowerCase().includes(q) ||
          m.overrideId.toLowerCase().includes(q),
      );
    }
    return { items: mapped };
  }

  async getById(actor: UserContext, overrideId: string, queryAgencyId?: string | null) {
    assertManageAccess(actor);
    const row = await repo.get(overrideId);
    if (!row) return null;
    const agency = actorAgency(actor, queryAgencyId ?? undefined);
    if (row.agencyId !== agency) throw new Error("FORBIDDEN");
    return { ...row, effectiveStatus: effectiveStatus(row) };
  }

  async listForUser(actor: UserContext, rawTargetUserId: string, queryAgencyId?: string | null) {
    assertManageAccess(actor);
    const agency = actorAgency(actor, queryAgencyId ?? undefined);
    const resolved = await resolveCognitoUser(rawTargetUserId.trim());
    if (!resolved?.agencyId) throw new Error("USER_NOT_FOUND");
    if (resolved.agencyId !== agency) throw new Error("FORBIDDEN");
    const key = resolved.sub || resolved.email;
    if (!key) throw new Error("USER_NOT_FOUND");
    const rows = await repo.queryByAgencyAndTargetUser(agency, key);
    const at = Date.now();
    return {
      items: rows.map((r) => ({ ...r, effectiveStatus: effectiveStatus(r, at) })),
    };
  }

  async grant(
    actor: UserContext,
    rawBody: unknown,
    event: APIGatewayProxyEventV2,
  ): Promise<AccessOverrideRecord & { effectiveStatus: AccessOverrideStatus }> {
    assertManageAccess(actor);
    if (!env.accessOverridesTable) throw new Error("ACCESS_OVERRIDES_DISABLED");

    const body = grantBodySchema.parse(rawBody);
    const agencyId = actorAgency(actor, body.agencyId?.trim());
    const meta = requestMeta(event);

    const target = await resolveCognitoUser(body.targetUserId.trim());
    if (!target?.agencyId) throw new Error("USER_NOT_FOUND");
    if (target.agencyId !== agencyId) throw new Error("FORBIDDEN");
    if (
      (target.sub && target.sub === actor.userId) ||
      (target.email && target.email.toLowerCase() === actor.email.toLowerCase())
    ) {
      throw new Error("SELF_GRANT_FORBIDDEN");
    }

    assertGrantWithinAuthority(actor, body.overrideType as AccessOverrideType, body.grantedRoleOrPermission);

    const now = new Date().toISOString();
    const overrideId = makeId("ovr");
    const record: AccessOverrideRecord = {
      overrideId,
      agencyId,
      targetUserKey: `${target.sub || target.email}#${overrideId}`,
      targetUserId: target.sub || target.email,
      targetUserEmail: target.email,
      targetUserName: target.name,
      grantedRoleOrPermission: body.grantedRoleOrPermission.trim(),
      overrideType: body.overrideType as AccessOverrideType,
      reason: body.reason.trim(),
      status: "active",
      grantedByUserId: actor.userId,
      grantedByName: actor.email,
      grantedAt: now,
      expiresAt: body.expiresAt?.trim() || null,
      revokedByUserId: null,
      revokedAt: null,
      revokeReason: null,
      createdAt: now,
      updatedAt: now,
    };

    await repo.put(record);
    await auditRepo.create(
      auditPayload({
        eventType: "access.override.granted",
        agencyId,
        actor,
        targetUserId: record.targetUserId,
        overrideId,
        action: "grant",
        reason: record.reason,
        before: null,
        after: record,
        meta,
      }),
    );

    await syncCognitoDashboardAccessFromOverrides(target, agencyId);

    return { ...record, effectiveStatus: effectiveStatus(record) };
  }

  async revoke(
    actor: UserContext,
    overrideId: string,
    rawBody: unknown,
    event: APIGatewayProxyEventV2,
    queryAgencyId?: string | null,
  ): Promise<AccessOverrideRecord & { effectiveStatus: AccessOverrideStatus }> {
    assertManageAccess(actor);
    if (!env.accessOverridesTable) throw new Error("ACCESS_OVERRIDES_DISABLED");

    const body = revokeBodySchema.parse(rawBody);
    const agency = actorAgency(actor, queryAgencyId ?? undefined);
    const existing = await repo.get(overrideId);
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.agencyId !== agency) throw new Error("FORBIDDEN");
    if (existing.status === "revoked") throw new Error("ALREADY_REVOKED");

    const meta = requestMeta(event);
    const now = new Date().toISOString();
    await repo.updateRevoked(overrideId, {
      status: "revoked",
      revokedByUserId: actor.userId,
      revokedAt: now,
      revokeReason: body.reason.trim(),
      updatedAt: now,
    });

    const updated = await repo.get(overrideId);
    const finalRow = updated ?? {
      ...existing,
      status: "revoked" as const,
      revokedByUserId: actor.userId,
      revokedAt: now,
      revokeReason: body.reason.trim(),
      updatedAt: now,
    };

    await auditRepo.create(
      auditPayload({
        eventType: "access.override.revoked",
        agencyId: agency,
        actor,
        targetUserId: finalRow.targetUserId,
        overrideId,
        action: "revoke",
        reason: body.reason.trim(),
        before: existing,
        after: finalRow,
        meta,
      }),
    );

    const targetLookup = await resolveCognitoUser(finalRow.targetUserId);
    if (targetLookup?.agencyId === agency) {
      await syncCognitoDashboardAccessFromOverrides(targetLookup, agency);
    }

    return { ...finalRow, effectiveStatus: "revoked" };
  }
}
