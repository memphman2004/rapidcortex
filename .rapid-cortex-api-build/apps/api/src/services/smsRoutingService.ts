import type { SmsRoutingRecord, SmsRoutingVertical, UserContext } from "rapid-cortex-shared";
import {
  createSmsRoutingBodySchema,
  patchSmsRoutingBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, canManageSmsRouting, canViewSmsRouting } from "rapid-cortex-security";
import { AuditRepository } from "../repositories/auditRepository.js";
import { SmsRoutingRepository } from "../repositories/smsRoutingRepository.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { normalizePhoneE164 } from "../lib/phone-hash.js";

const repo = new SmsRoutingRepository();
const auditRepo = new AuditRepository();

function assertTable(): void {
  if (!env.smsRoutingTable) throw new Error("SMS_ROUTING_TABLE_NOT_CONFIGURED");
}

export class SmsRoutingService {
  async resolveAgencyFromPhone(
    toNumber: string,
  ): Promise<{ agencyId: string; vertical: SmsRoutingVertical; agencyName: string } | null> {
    if (!env.smsRoutingTable) return null;
    const phoneNumber = normalizePhoneE164(toNumber);
    const row = await repo.getByPhone(phoneNumber);
    if (!row || !row.active) return null;
    return {
      agencyId: row.agencyId,
      vertical: row.vertical,
      agencyName: row.agencyName,
    };
  }

  async listForAgency(agencyId: string, user: UserContext): Promise<{ items: SmsRoutingRecord[] }> {
    assertTable();
    if (!canViewSmsRouting(user, agencyId)) throw new Error("FORBIDDEN");
    const items = await repo.listByAgency(agencyId);
    return { items };
  }

  async register(rawBody: unknown, user: UserContext): Promise<SmsRoutingRecord> {
    assertTable();
    const body = createSmsRoutingBodySchema.parse(rawBody);
    if (!canManageSmsRouting(user, body.agencyId)) throw new Error("FORBIDDEN");

    const phoneNumber = normalizePhoneE164(body.phoneNumber);
    const existing = await repo.getByPhone(phoneNumber);
    if (existing?.active) throw new Error("VALIDATION:Phone number already registered");

    const now = new Date().toISOString();
    const record: SmsRoutingRecord = {
      phoneNumber,
      agencyId: body.agencyId,
      vertical: body.vertical,
      agencyName: body.agencyName,
      label: body.label,
      active: true,
      createdAt: now,
      createdBy: user.userId,
      updatedAt: now,
    };
    await repo.put(record);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: body.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SMS_ROUTING_REGISTERED,
      details: { phoneNumber, vertical: body.vertical, label: body.label },
      createdAt: now,
      resourceType: "sms_routing",
      resourceId: phoneNumber,
    });

    return record;
  }

  async patch(phoneNumberRaw: string, rawBody: unknown, user: UserContext): Promise<SmsRoutingRecord> {
    assertTable();
    const phoneNumber = normalizePhoneE164(phoneNumberRaw);
    const existing = await repo.getByPhone(phoneNumber);
    if (!existing) throw new Error("NOT_FOUND");
    if (!canManageSmsRouting(user, existing.agencyId)) throw new Error("FORBIDDEN");

    const body = patchSmsRoutingBodySchema.parse(rawBody);
    const updated = await repo.patch(phoneNumber, {
      ...body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error("NOT_FOUND");

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: existing.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SMS_ROUTING_UPDATED,
      details: { phoneNumber, ...body },
      createdAt: new Date().toISOString(),
      resourceType: "sms_routing",
      resourceId: phoneNumber,
    });

    return updated;
  }

  async deactivate(phoneNumberRaw: string, user: UserContext): Promise<{ ok: true }> {
    assertTable();
    const phoneNumber = normalizePhoneE164(phoneNumberRaw);
    const existing = await repo.getByPhone(phoneNumber);
    if (!existing) throw new Error("NOT_FOUND");
    if (!canManageSmsRouting(user, existing.agencyId)) throw new Error("FORBIDDEN");

    await repo.patch(phoneNumber, { active: false, updatedAt: new Date().toISOString() });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: existing.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SMS_ROUTING_DEACTIVATED,
      details: { phoneNumber },
      createdAt: new Date().toISOString(),
      resourceType: "sms_routing",
      resourceId: phoneNumber,
    });

    return { ok: true };
  }
}

export const smsRoutingService = new SmsRoutingService();
