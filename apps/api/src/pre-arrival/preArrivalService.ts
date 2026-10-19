import { randomBytes } from "node:crypto";
import {
  classifyPreArrivalSessionMode,
  decideCadAutoOpen,
  createPreArrivalSessionBodySchema,
  DEFAULT_RESPONSE_IQ_MODE_POLICY,
  resolveResponseIQInstructions,
  toE164,
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
    const cadNatureCode = (input.cadNatureCode ?? incident.cadNatureCode ?? "").toString().trim();
    if (!cadNatureCode || cadNatureCode.toUpperCase() === "UNKNOWN") {
      throw Object.assign(new Error("PRE_ARRIVAL_REASON_REQUIRED"), { statusCode: 400 });
    }
    const sessionMode = classifyPreArrivalSessionMode(cadNatureCode);
    if (sessionMode === "RESTRICTED") {
      throw Object.assign(new Error("PRE_ARRIVAL_RESTRICTED"), { statusCode: 403 });
    }
    const sessionToken = randomBytes(16).toString("hex");
    const modePolicy = { ...DEFAULT_RESPONSE_IQ_MODE_POLICY, ...input.modePolicy };
    const resolved = resolveResponseIQInstructions({ cadNatureCode, policy: modePolicy });

    const instructionSet = sessionMode === "FULL" ? resolved.instructions : [];
    const activeSteps: ActiveStep[] = instructionSet.map((ins) => ({
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
    // Short public path. /r/* is reserved for QR intake (RCLI), so Pre-Arrival uses /pa/.
    const publicUrl = `${baseUrl}/pa/${sessionToken}`;

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
      instructions: instructionSet,
      activeSteps,
      modePolicy,
      responderStatus: "dispatched",
      sessionMode,
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
        message:
          sessionMode === "STATUS_ONLY"
            ? `Help has been dispatched. You can check response status here: ${publicUrl}`
            : `Help is on the way. You can track the response and get guidance here: ${publicUrl}`,
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
    if ((session.sessionMode ?? classifyPreArrivalSessionMode(session.cadNatureCode)) !== "FULL") {
      throw Object.assign(new Error("INSTRUCTIONS_NOT_AVAILABLE"), { statusCode: 403 });
    }

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

  /**
   * Open a session from a CAD incident event. Restricted natures leave no record.
   * An incident that already has an open session is left alone.
   */
  async createFromCad(input: {
    incidentId: string;
    agencyId: string;
    cadNatureCode?: string;
    callerPhoneE164?: string | null;
  }) {
    assertEnabled();
    const incident = await incidentRepo.get(input.incidentId);
    if (!incident || incident.agencyId !== input.agencyId) {
      return { opened: false, reason: "not_found" as const };
    }
    const existing = await preArrivalSessionStore.getActiveByIncident(input.incidentId, input.agencyId);
    const nature = (input.cadNatureCode ?? incident.cadNatureCode ?? "").trim();
    const phone = toE164(input.callerPhoneE164 ?? incident.callerCallback);
    const decision = decideCadAutoOpen({
      natureCode: nature,
      callerPhoneE164: phone,
      hasOpenSession: Boolean(existing),
    });
    if (decision !== "open" || !phone) {
      return { opened: false, reason: decision, sessionToken: existing?.sessionToken };
    }
    const user: UserContext = {
      userId: "system:cad",
      agencyId: input.agencyId,
      role: "dispatcher",
      email: "cad@nexcortiq.local",
    };
    const created = await this.createSession(input.incidentId, user, {
      incidentId: input.incidentId,
      callerPhoneE164: phone,
      cadNatureCode: nature,
      sendSms: true,
    });
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: input.agencyId,
        incidentId: input.incidentId,
        actorId: "system:cad",
        type: AUDIT_EVENT_TYPES.PRE_ARRIVAL_CAD_OPENED,
        details: { sessionToken: created.token.slice(0, 8), cadNatureCode: nature },
        createdAt: new Date().toISOString(),
        resourceType: "session",
        resourceId: created.token,
      });
    } catch {
      /* never abort */
    }
    return { opened: true, reason: "open" as const, sessionToken: created.token, publicUrl: created.publicUrl };
  }
}

export const preArrivalService = new PreArrivalService();
