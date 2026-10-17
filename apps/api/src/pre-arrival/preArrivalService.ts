import { randomBytes } from "node:crypto";
import {
  createPreArrivalSessionBodySchema,
  DEFAULT_RESPONSE_IQ_MODE_POLICY,
  resolveResponseIQInstructions,
  toPreArrivalPublicView,
  type ActiveStep,
  type CreatePreArrivalSessionBody,
  type PreArrivalSession,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, TenantAccessGuard } from "rapid-cortex-security";
import type { UserContext } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { preArrivalSessionStore } from "./session-store.js";
import { sendPreArrivalSms } from "./sms.js";

const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function assertEnabled(): void {
  if (!env.enablePreArrivalIq) throw Object.assign(new Error("PRE_ARRIVAL_DISABLED"), { statusCode: 503 });
  if (!env.preArrivalSessionsTable) {
    throw Object.assign(new Error("PRE_ARRIVAL_TABLE_NOT_CONFIGURED"), { statusCode: 503 });
  }
}

export class PreArrivalService {
  async createSession(incidentId: string, user: UserContext, body: unknown) {
    assertEnabled();
    const parsed = createPreArrivalSessionBodySchema.safeParse(body);
    if (!parsed.success) throw Object.assign(new Error(`VALIDATION:${parsed.error.message}`), { statusCode: 400 });

    const input: CreatePreArrivalSessionBody = parsed.data;
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);

    const now = new Date().toISOString();
    const sessionToken = randomBytes(24).toString("base64url");
    const cadNatureCode = (
      input.cadNatureCode ??
      incident.cadNatureCode ??
      incident.type ??
      "UNKNOWN"
    ).toString();
    const modePolicy = { ...DEFAULT_RESPONSE_IQ_MODE_POLICY, ...input.modePolicy };
    const resolved = resolveResponseIQInstructions({ cadNatureCode, policy: modePolicy });

    const activeSteps: ActiveStep[] = resolved.instructions.map((ins) => ({
      stepId: ins.stepId,
      protocolId: resolved.protocolId,
      cadNatureCode,
      order: ins.order,
      category: ins.category,
      text: ins.text,
      status: "ACTIVE",
      activatedAt: now,
    }));

    const baseUrl =
      input.publicAppBaseUrl?.replace(/\/$/, "") ||
      env.preArrivalPublicBaseUrl.replace(/\/$/, "") ||
      "";
    if (!baseUrl) throw Object.assign(new Error("MISSING_PUBLIC_BASE_URL"), { statusCode: 400 });
    const publicUrl = `${baseUrl}/pre-arrival/${sessionToken}`;

    const ttlMinutes = input.ttlMinutes ?? 120;
    const session: PreArrivalSession = {
      sessionToken,
      agencyId: incident.agencyId,
      incidentId,
      callerPhoneE164: input.callerPhoneE164,
      status: "pending_send",
      cadNatureCode,
      protocolId: resolved.protocolId,
      instructionSource: resolved.source,
      instructions: resolved.instructions,
      activeSteps,
      modePolicy,
      responderStatus: "dispatched",
      publicUrl,
      createdAt: now,
      updatedAt: now,
      createdByUserId: user.userId,
      etaNotifications: [],
      ttl: Math.floor(Date.now() / 1000) + ttlMinutes * 60,
    };

    let smsOk = false;
    let smsProvider = "config";
    if (input.sendSms !== false) {
      const sms = await sendPreArrivalSms({
        phoneE164: input.callerPhoneE164,
        message: `Help is on the way. Open this secure link for guidance while you wait: ${publicUrl}`,
        agencyId: incident.agencyId,
        incidentId,
      });
      smsOk = sms.ok;
      smsProvider = sms.provider;
      session.status = sms.ok ? "sms_sent" : "failed";
    } else {
      session.status = "active";
      smsOk = true;
      smsProvider = "mock";
    }

    await preArrivalSessionStore.put(session);

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.PRE_ARRIVAL_SESSION_CREATED,
        details: { sessionToken: sessionToken.slice(0, 8), cadNatureCode, source: resolved.source },
        createdAt: now,
        resourceType: "session",
        resourceId: sessionToken,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: smsOk ? AUDIT_EVENT_TYPES.PRE_ARRIVAL_SMS_SENT : AUDIT_EVENT_TYPES.PRE_ARRIVAL_SMS_FAILED,
        details: { sessionToken: sessionToken.slice(0, 8), provider: smsProvider },
        createdAt: now,
        resourceType: "session",
        resourceId: sessionToken,
      });
    } catch {
      /* never abort */
    }

    return { session, token: sessionToken, publicUrl };
  }

  async getDispatcherSession(incidentId: string, sessionToken: string, agencyId: string) {
    assertEnabled();
    const session = await preArrivalSessionStore.getForAgency(sessionToken, agencyId);
    if (!session || session.incidentId !== incidentId) {
      throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
    }
    return session;
  }

  async listSessions(incidentId: string, agencyId: string) {
    assertEnabled();
    return preArrivalSessionStore.listByIncident(incidentId, agencyId);
  }

  async getPublic(sessionToken: string) {
    assertEnabled();
    const session = await preArrivalSessionStore.getByToken(sessionToken);
    if (!session) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
    if (session.status === "terminated" || session.status === "ended") {
      throw Object.assign(new Error("SESSION_ENDED"), { statusCode: 409 });
    }
    if (session.ttl && session.ttl < Math.floor(Date.now() / 1000)) {
      throw Object.assign(new Error("SESSION_EXPIRED"), { statusCode: 410 });
    }

    const now = new Date().toISOString();
    if (!session.openedAt) {
      await preArrivalSessionStore.updateFields(session.agencyId, session.sessionToken, {
        openedAt: now,
        status: "active",
        updatedAt: now,
      });
      try {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: session.agencyId,
          incidentId: session.incidentId,
          actorId: "caller:public",
          type: AUDIT_EVENT_TYPES.PRE_ARRIVAL_OPENED,
          details: { sessionToken: sessionToken.slice(0, 8) },
          createdAt: now,
          resourceType: "session",
          resourceId: sessionToken,
        });
      } catch {
        /* ignore */
      }
      session.openedAt = now;
      session.status = "active";
    }

    return toPreArrivalPublicView(session);
  }

  async completeStep(sessionToken: string, stepId: string) {
    assertEnabled();
    const session = await preArrivalSessionStore.getByToken(sessionToken);
    if (!session) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });

    const now = new Date().toISOString();
    const instructions = session.instructions.map((ins) =>
      ins.stepId === stepId ? { ...ins, status: "COMPLETED" as const } : ins,
    );
    const activeSteps = session.activeSteps.map((s) =>
      s.stepId === stepId ? { ...s, status: "COMPLETED" as const, completedAt: now } : s,
    );
    await preArrivalSessionStore.updateFields(session.agencyId, session.sessionToken, {
      instructions,
      activeSteps,
      updatedAt: now,
    });

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: session.agencyId,
        incidentId: session.incidentId,
        actorId: "caller:public",
        type: AUDIT_EVENT_TYPES.PRE_ARRIVAL_STEP_COMPLETED,
        details: { stepId },
        createdAt: now,
        resourceType: "session",
        resourceId: sessionToken,
      });
    } catch {
      /* ignore */
    }

    return toPreArrivalPublicView({ ...session, instructions, activeSteps, updatedAt: now });
  }

  async endSession(incidentId: string, sessionToken: string, agencyId: string, userId: string) {
    assertEnabled();
    const session = await this.getDispatcherSession(incidentId, sessionToken, agencyId);
    const now = new Date().toISOString();
    await preArrivalSessionStore.updateFields(agencyId, sessionToken, {
      status: "ended",
      endedAt: now,
      updatedAt: now,
    });
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        incidentId,
        actorId: userId,
        type: AUDIT_EVENT_TYPES.PRE_ARRIVAL_SESSION_ENDED,
        details: {},
        createdAt: now,
        resourceType: "session",
        resourceId: sessionToken,
      });
    } catch {
      /* ignore */
    }
    return { ...session, status: "ended" as const, endedAt: now };
  }
}

export const preArrivalService = new PreArrivalService();
