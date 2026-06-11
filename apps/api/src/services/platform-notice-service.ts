import { randomUUID } from "node:crypto";
import type {
  CreateNoticeInput,
  NoticeVertical,
  PlatformNotice,
} from "rapid-cortex-shared";
import { createNoticeInputSchema } from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { PlatformNoticesRepository } from "../repositories/platformNoticesRepository.js";

const repo = new PlatformNoticesRepository();
const auditRepo = new AuditRepository();

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function deriveVerticalFromAgencyId(agencyId: string): NoticeVertical {
  const token = agencyId.trim().toLowerCase();
  if (token.includes("campus-")) return "campus";
  if (token.includes("venue-")) return "venue";
  if (token.includes("hospital")) return "hospital";
  if (token.includes("transit-")) return "transit";
  return "core";
}

export async function createPlatformNotice(
  input: CreateNoticeInput,
  actor: UserContext,
): Promise<PlatformNotice> {
  const parsed = createNoticeInputSchema.parse(input);
  const now = new Date();
  const expiresInHours = parsed.expiresInHours ?? 24;
  const expiresAt = Math.floor(now.getTime() / 1000) + expiresInHours * 3600;
  const noticeId = `notice_${randomUUID()}`;

  const notice: PlatformNotice = {
    noticeId,
    targetType: parsed.targetType,
    targetVertical: parsed.targetType === "vertical" ? parsed.targetVertical : undefined,
    targetAgencyId: parsed.targetType === "agency" ? parsed.targetAgencyId : undefined,
    severity: parsed.severity,
    title: parsed.title.trim(),
    message: parsed.message.trim(),
    createdBy: actor.userId,
    createdByRole: actor.role,
    createdAt: now.toISOString(),
    expiresAt,
    expiresAtIso: new Date(expiresAt * 1000).toISOString(),
    dismissible: parsed.dismissible ?? true,
    requiresAck: parsed.requiresAck ?? false,
  };

  await repo.put(notice);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: AUDIT_EVENT_TYPES.PLATFORM_NOTICE_CREATED,
    details: {
      noticeId,
      targetType: notice.targetType,
      targetVertical: notice.targetVertical,
      targetAgencyId: notice.targetAgencyId,
      severity: notice.severity,
    },
    createdAt: notice.createdAt,
    resourceType: "platform_notice",
    resourceId: noticeId,
  });

  return notice;
}

export async function listAdminNotices(opts?: {
  targetType?: PlatformNotice["targetType"];
  targetAgencyId?: string;
}): Promise<PlatformNotice[]> {
  let rows = await repo.listActive({ limit: 100 });
  if (opts?.targetType) {
    rows = rows.filter((n) => n.targetType === opts.targetType);
  }
  if (opts?.targetAgencyId) {
    rows = rows.filter(
      (n) => n.targetType !== "agency" || n.targetAgencyId === opts.targetAgencyId,
    );
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function cancelPlatformNotice(
  noticeId: string,
  actor: UserContext,
): Promise<PlatformNotice | null> {
  const updated = await repo.expireNow(noticeId);
  if (!updated) return null;

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: AUDIT_EVENT_TYPES.PLATFORM_NOTICE_CANCELLED,
    details: { noticeId },
    createdAt: new Date().toISOString(),
    resourceType: "platform_notice",
    resourceId: noticeId,
  });

  return updated;
}

export function noticeAppliesToUser(notice: PlatformNotice, user: UserContext): boolean {
  const vertical = deriveVerticalFromAgencyId(user.agencyId);
  if (notice.targetType === "all") return true;
  if (notice.targetType === "vertical") {
    return notice.targetVertical === vertical;
  }
  if (notice.targetType === "agency") {
    return notice.targetAgencyId === user.agencyId;
  }
  return false;
}

export async function listActiveNoticesForUser(user: UserContext): Promise<PlatformNotice[]> {
  const rows = await repo.listActive({ limit: 100 });
  const applicable = rows.filter((n) => noticeAppliesToUser(n, user));
  return applicable.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function acknowledgePlatformNotice(
  noticeId: string,
  user: UserContext,
): Promise<{ acked: boolean }> {
  const notice = await repo.get(noticeId);
  if (!notice || notice.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("NOT_FOUND");
  }
  if (!noticeAppliesToUser(notice, user)) {
    throw new Error("FORBIDDEN");
  }

  try {
    await repo.recordAck(noticeId, user.userId, user.agencyId);
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return { acked: true };
    }
    throw error;
  }

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: user.agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.PLATFORM_NOTICE_ACKED,
    details: { noticeId },
    createdAt: new Date().toISOString(),
    resourceType: "platform_notice",
    resourceId: noticeId,
  });

  return { acked: true };
}
