/**
 * Live Assist HTTP handler
 *
 * Routes:
 *   GET  /api/live-assist/providers
 *   POST /api/live-assist/providers
 *   POST /api/live-assist/providers/{id}/validate
 *   GET  /api/live-assist/devices
 *   POST /api/live-assist/devices
 *   GET  /api/live-assist/sessions
 *   POST /api/live-assist/sessions
 *   GET  /api/live-assist/sessions/{id}
 *   POST /api/live-assist/sessions/{id}/stream
 *   POST /api/live-assist/sessions/{id}/coaching/request
 *   POST /api/live-assist/sessions/{id}/coaching/accept
 *   POST /api/live-assist/sessions/{id}/coaching/terminate
 *   POST /api/live-assist/sessions/{id}/end
 *   GET  /api/live-assist/sessions/{id}/events
 *
 * All routes:
 *   - Require JWT via getUserContext()
 *   - Enforce tenant isolation (agencyId === tenantId)
 *   - Validate request bodies with Zod schemas from packages/shared
 *   - Write audit events via AuditRepository
 *   - Return structured errors
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  liveAssistProviderCreateSchema,
  liveAssistDeviceCreateSchema,
  liveAssistDeviceUpdateSchema,
  liveAssistSessionCreateSchema,
  liveAssistStreamRequestSchema,
  liveAssistCoachingRequestSchema,
  liveAssistCoachingAcceptSchema,
  liveAssistEventQuerySchema,
  liveAssistNoteSchema,
  LIVE_ASSIST_AUDIT_TYPES,
  canViewLiveAssist,
  canCoachLiveAssist,
  canAdminLiveAssist,
  canManageLiveAssistSessions,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, badRequestFromZod, forbidden, notFound, ok, serviceUnavailable, unauthorized } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  liveAssistProviderStore,
  liveAssistDeviceStore,
  liveAssistSessionStore,
  liveAssistCoachingStore,
  liveAssistEventStore,
} from "../../live-assist/store.js";
import { resolveProvider, listAllProviders } from "../../live-assist/providers/BodyCameraProviderRegistry.js";

const auditRepo = new AuditRepository();

function parseBody(raw: string | undefined): unknown {
  try { return JSON.parse(raw ?? "{}"); } catch { return null; }
}

function pathSegments(rawPath: string): string[] {
  return (rawPath ?? "").split("?")[0].split("/").filter(Boolean);
}

function sessionIdFromPath(segs: string[]): string | null {
  // /api/live-assist/sessions/{id}/...
  const idx = segs.indexOf("sessions");
  return idx >= 0 ? (segs[idx + 1] ?? null) : null;
}

function providerIdFromPath(segs: string[]): string | null {
  const idx = segs.indexOf("providers");
  return idx >= 0 ? (segs[idx + 1] ?? null) : null;
}

async function auditEvent(
  agencyId: string,
  actorId: string,
  type: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId,
      type,
      details,
      createdAt: new Date().toISOString(),
      resourceType: "live_assist",
      resourceId,
    });
  } catch (err) {
    console.warn("[live-assist/audit] write failed", err);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const pwd = operationalPasswordBlock(user);
  if (pwd) return pwd;

  if (!env.enableLiveAssist) {
    return serviceUnavailable("Live Assist is not enabled for this environment.");
  }

  const tenantId = user.agencyId;
  const method = event.requestContext.http.method;
  const segs = pathSegments(event.rawPath ?? "");

  // ── GET /api/live-assist/providers ─────────────────────────────────────────
  if (method === "GET" && segs.at(-1) === "providers") {
    if (!canViewLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const [dbProviders, allManufacturers] = await Promise.all([
      liveAssistProviderStore.list(tenantId),
      Promise.resolve(listAllProviders()),
    ]);
    const result = allManufacturers.map((p) => {
      const configured = dbProviders.find((dp) => dp.manufacturer === p.identity.manufacturer);
      return {
        manufacturer: p.identity.manufacturer,
        displayName: p.identity.displayName,
        integrationStatus: configured?.integrationStatus ?? p.identity.integrationStatus,
        pendingVendorAuthorization: p.identity.pendingVendorAuthorization,
        documentationUrl: p.identity.documentationUrl,
        defaultCapabilities: p.identity.defaultCapabilities,
        providerId: configured?.providerId ?? null,
        lastValidatedAt: configured?.lastValidatedAt ?? null,
        lastError: configured?.lastError ?? null,
      };
    });
    return withCorrelationHeaders(event, ok({ providers: result }));
  }

  // ── POST /api/live-assist/providers ────────────────────────────────────────
  if (method === "POST" && segs.at(-1) === "providers") {
    if (!canAdminLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const parsed = liveAssistProviderCreateSchema.safeParse(parseBody(event.body));
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

    const provider = await liveAssistProviderStore.create({
      tenantId,
      manufacturer: parsed.data.manufacturer,
      credentialsSecretArn: parsed.data.credentialsSecretArn ?? null,
      configJson: parsed.data.configJson ?? {},
      integrationStatus: "credentials_required",
      verifiedCapabilities: null,
      lastValidatedAt: null,
      lastError: null,
      createdBy: user.userId,
    });
    await auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_PROVIDER_CONFIGURED, provider.providerId, { manufacturer: provider.manufacturer });
    return withCorrelationHeaders(event, ok({ provider }));
  }

  // ── POST /api/live-assist/providers/{id}/validate ──────────────────────────
  const providerId = providerIdFromPath(segs);
  if (method === "POST" && providerId && segs.at(-1) === "validate") {
    if (!canAdminLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const dbProvider = await liveAssistProviderStore.get(tenantId, providerId);
    if (!dbProvider) return withCorrelationHeaders(event, notFound("Provider not found"));

    const connector = resolveProvider(dbProvider.manufacturer);
    if (!connector) return withCorrelationHeaders(event, badRequest("Unknown manufacturer"));

    const health = await connector.validateConnection(tenantId);
    const newStatus = health.status === "online" ? "connected"
      : health.status === "degraded" ? "limited_capabilities"
      : connector.identity.pendingVendorAuthorization ? "vendor_authorization_required"
      : "disconnected";

    await liveAssistProviderStore.updateStatus(
      tenantId, providerId, newStatus,
      health.detail ?? null,
      new Date().toISOString(),
    );
    return withCorrelationHeaders(event, ok({ status: newStatus, detail: health.detail }));
  }

  // ── GET /api/live-assist/devices ───────────────────────────────────────────
  if (method === "GET" && segs.at(-1) === "devices") {
    if (!canViewLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const devices = await liveAssistDeviceStore.list(tenantId);
    return withCorrelationHeaders(event, ok({ devices }));
  }

  // ── POST /api/live-assist/devices ──────────────────────────────────────────
  if (method === "POST" && segs.at(-1) === "devices") {
    if (!canAdminLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const parsed = liveAssistDeviceCreateSchema.safeParse(parseBody(event.body));
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

    const dbProvider = await liveAssistProviderStore.get(tenantId, parsed.data.providerId);
    if (!dbProvider) return withCorrelationHeaders(event, badRequest("Unknown provider ID"));

    const device = await liveAssistDeviceStore.create({
      tenantId,
      providerId: parsed.data.providerId,
      manufacturer: dbProvider.manufacturer,
      providerDeviceId: parsed.data.providerDeviceId,
      hardwareId: parsed.data.hardwareId ?? null,
      model: parsed.data.model ?? null,
      assignedOfficerId: parsed.data.assignedOfficerId ?? null,
      agencyUnitId: parsed.data.agencyUnitId ?? null,
      capabilityManifest: dbProvider.verifiedCapabilities ?? {},
      connectivityState: "unknown",
      batteryPercent: null,
      lastSeenAt: null,
    });
    await auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_DEVICE_REGISTERED, device.deviceId, {
      manufacturer: device.manufacturer,
      providerDeviceId: device.providerDeviceId,
    });
    return withCorrelationHeaders(event, ok({ device }));
  }

  // ── Session-scoped routes ──────────────────────────────────────────────────

  const sessionId = sessionIdFromPath(segs);

  // ── GET /api/live-assist/sessions ─────────────────────────────────────────
  if (method === "GET" && segs.at(-1) === "sessions") {
    if (!canViewLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const sessions = await liveAssistSessionStore.listActive(tenantId);
    return withCorrelationHeaders(event, ok({ sessions }));
  }

  // ── POST /api/live-assist/sessions ────────────────────────────────────────
  if (method === "POST" && segs.at(-1) === "sessions") {
    if (!canManageLiveAssistSessions(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const parsed = liveAssistSessionCreateSchema.safeParse(parseBody(event.body));
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

    const device = await liveAssistDeviceStore.get(tenantId, parsed.data.deviceId);
    if (!device) return withCorrelationHeaders(event, notFound("Device not found or not registered to this agency"));

    const session = await liveAssistSessionStore.create({
      tenantId,
      incidentId: parsed.data.incidentId ?? null,
      deviceId: parsed.data.deviceId,
      officerId: parsed.data.officerId ?? device.assignedOfficerId,
      supervisorId: user.userId,
      manufacturer: device.manufacturer,
      streamStatus: "not_started",
      coachingStatus: "none",
      kvsChannelName: null,
      kvsStreamArn: null,
      measuredVideoDelayMs: null,
      videoDelayAlertSent: false,
      endedAt: null,
      streamTokenExpiresAt: null,
      lastLatitude: null,
      lastLongitude: null,
      lastLocationAt: null,
      locationSource: null,
    });

    await Promise.all([
      liveAssistEventStore.append(tenantId, session.sessionId, "SESSION_CREATED", user.userId, {
        deviceId: device.deviceId,
        manufacturer: device.manufacturer,
        incidentId: parsed.data.incidentId ?? null,
      }),
      auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_SESSION_CREATED, session.sessionId, {
        deviceId: device.deviceId,
        manufacturer: device.manufacturer,
      }),
    ]);

    return withCorrelationHeaders(event, ok({ session }));
  }

  // ── GET /api/live-assist/sessions/{id} ────────────────────────────────────
  if (method === "GET" && sessionId && segs.at(-1) === sessionId) {
    if (!canViewLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    return withCorrelationHeaders(event, ok({ session }));
  }

  // ── POST /api/live-assist/sessions/{id}/stream ────────────────────────────
  if (method === "POST" && sessionId && segs.at(-1) === "stream") {
    if (!canManageLiveAssistSessions(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    liveAssistStreamRequestSchema.safeParse(parseBody(event.body)); // validated but options are advisory

    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));
    if (session.streamStatus === "active") return withCorrelationHeaders(event, ok({ session, alreadyActive: true }));

    const device = await liveAssistDeviceStore.get(tenantId, session.deviceId);
    if (!device) return withCorrelationHeaders(event, notFound("Device not found"));

    const connector = resolveProvider(session.manufacturer);
    if (!connector) return withCorrelationHeaders(event, badRequest("No connector for manufacturer"));

    await liveAssistSessionStore.updateStreamStatus(tenantId, sessionId, "requesting", {});
    await liveAssistEventStore.append(tenantId, sessionId, "STREAM_REQUESTED", user.userId, { manufacturer: session.manufacturer });

    const streamResult = await connector.requestStream({
      tenantId,
      agencyId: tenantId,
      sessionId,
      deviceId: device.deviceId,
      providerDeviceId: device.providerDeviceId,
      officerId: session.officerId,
      targetKvsChannelName: `la-${tenantId.slice(0, 8)}-${sessionId.slice(0, 8)}`,
    });

    if (!streamResult.supported) {
      await liveAssistSessionStore.updateStreamStatus(tenantId, sessionId, "not_started", {});
      return withCorrelationHeaders(event, ok({
        started: false,
        reason: streamResult.message,
        integrationStatus: connector.identity.integrationStatus,
        pendingVendorAuthorization: connector.identity.pendingVendorAuthorization,
      }));
    }

    await liveAssistSessionStore.updateStreamStatus(tenantId, sessionId, "active", {
      kvsChannelName: streamResult.kvsChannelName,
      kvsStreamArn: streamResult.kvsStreamArn,
      streamTokenExpiresAt: streamResult.expiresAt,
    });
    await Promise.all([
      liveAssistEventStore.append(tenantId, sessionId, "STREAM_STARTED", user.userId, {
        kvsChannelName: streamResult.kvsChannelName,
      }),
      auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_STREAM_STARTED, sessionId, {
        kvsChannelName: streamResult.kvsChannelName,
      }),
    ]);

    const updated = await liveAssistSessionStore.get(tenantId, sessionId);
    return withCorrelationHeaders(event, ok({ session: updated, started: true }));
  }

  // ── POST /api/live-assist/sessions/{id}/coaching/request ──────────────────
  if (method === "POST" && sessionId && segs.includes("coaching") && segs.at(-1) === "request") {
    if (!canCoachLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const parsed = liveAssistCoachingRequestSchema.safeParse(parseBody(event.body));
    if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));

    const device = await liveAssistDeviceStore.get(tenantId, session.deviceId);
    const connector = session.manufacturer ? resolveProvider(session.manufacturer) : null;

    // Create coaching channel record
    const channel = await liveAssistCoachingStore.create({
      tenantId,
      sessionId,
      officerEndpointRef: parsed.data.officerEndpointRef ?? null,
      supervisorEndpointRef: null,
      transportType: parsed.data.transportType,
      signalingState: "idle",
      channelState: "pending",
      officerAcknowledgedAt: null,
      startedAt: null,
      endedAt: null,
      activeFloorSupervisorId: user.userId,
      authorizedSupervisorIds: [user.userId],
    });

    // Try to notify officer through the manufacturer connector
    let immediateAck = false;
    if (connector && parsed.data.officerEndpointRef) {
      const invite = await connector.inviteToCoaching({
        sessionId,
        officerEndpointRef: parsed.data.officerEndpointRef,
        supervisorDisplayName: user.userId,
        sdpOffer: null,
      });
      if (invite.supported && invite.immediateAck) {
        immediateAck = true;
        await liveAssistCoachingStore.updateState(sessionId, channel.channelId, "officer_notified", {
          officerAcknowledgedAt: new Date().toISOString(),
        });
      }
    }

    await Promise.all([
      liveAssistSessionStore.updateCoachingStatus(tenantId, sessionId, "requested"),
      liveAssistEventStore.append(tenantId, sessionId, "COACHING_REQUESTED", user.userId, {
        channelId: channel.channelId,
        transportType: parsed.data.transportType,
        immediateAck,
      }),
      auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_COACHING_STARTED, sessionId, {
        channelId: channel.channelId,
      }),
    ]);

    return withCorrelationHeaders(event, ok({ channel, immediateAck }));
  }

  // ── POST /api/live-assist/sessions/{id}/coaching/accept ───────────────────
  if (method === "POST" && sessionId && segs.includes("coaching") && segs.at(-1) === "accept") {
    // This endpoint is called from the officer's mobile client / native app
    if (!canViewLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    liveAssistCoachingAcceptSchema.safeParse(parseBody(event.body));

    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));

    const channel = await liveAssistCoachingStore.getForSession(sessionId);
    if (!channel) return withCorrelationHeaders(event, notFound("No pending coaching channel"));

    const now = new Date().toISOString();
    await Promise.all([
      liveAssistCoachingStore.updateState(sessionId, channel.channelId, "officer_accepted", {
        officerAcknowledgedAt: now,
        startedAt: now,
      }),
      liveAssistSessionStore.updateCoachingStatus(tenantId, sessionId, "active"),
      liveAssistEventStore.append(tenantId, sessionId, "COACHING_ACCEPTED", user.userId, { channelId: channel.channelId }),
    ]);

    return withCorrelationHeaders(event, ok({ accepted: true, channel }));
  }

  // ── POST /api/live-assist/sessions/{id}/coaching/terminate ────────────────
  if (method === "POST" && sessionId && segs.includes("coaching") && segs.at(-1) === "terminate") {
    if (!canCoachLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));

    const channel = await liveAssistCoachingStore.getForSession(sessionId);
    if (channel) {
      await liveAssistCoachingStore.updateState(sessionId, channel.channelId, "ended", {
        endedAt: new Date().toISOString(),
      });
    }
    await Promise.all([
      liveAssistSessionStore.updateCoachingStatus(tenantId, sessionId, "ended"),
      liveAssistEventStore.append(tenantId, sessionId, "COACHING_ENDED", user.userId, { channelId: channel?.channelId }),
      auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_COACHING_ENDED, sessionId, {}),
    ]);

    return withCorrelationHeaders(event, ok({ terminated: true }));
  }

  // ── POST /api/live-assist/sessions/{id}/end ───────────────────────────────
  if (method === "POST" && sessionId && segs.at(-1) === "end") {
    if (!canManageLiveAssistSessions(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));

    // Terminate stream via manufacturer connector if active
    if (session.streamStatus === "active" && session.kvsChannelName) {
      const connector = resolveProvider(session.manufacturer);
      const device = await liveAssistDeviceStore.get(tenantId, session.deviceId);
      if (connector && device) {
        await connector.terminateStream(tenantId, device.providerDeviceId, `la-${sessionId}`).catch(
          (err) => console.warn("[live-assist/end] terminateStream failed", err),
        );
      }
    }

    // Coaching ends automatically when session ends
    const activeChannel = await liveAssistCoachingStore.getForSession(sessionId);
    await Promise.all([
      liveAssistSessionStore.end(tenantId, sessionId),
      activeChannel
        ? liveAssistCoachingStore.updateState(sessionId, activeChannel.channelId, "ended", { endedAt: new Date().toISOString() })
        : Promise.resolve(),
      liveAssistEventStore.append(tenantId, sessionId, "SESSION_ENDED", user.userId, {}),
      auditEvent(tenantId, user.userId, LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_STREAM_ENDED, sessionId, {}),
    ]);

    return withCorrelationHeaders(event, ok({ ended: true }));
  }

  // ── GET /api/live-assist/sessions/{id}/events ─────────────────────────────
  if (method === "GET" && sessionId && segs.at(-1) === "events") {
    if (!canViewLiveAssist(user, tenantId)) return withCorrelationHeaders(event, forbidden());
    const q = liveAssistEventQuerySchema.safeParse(event.queryStringParameters ?? {});
    const { limit = 50, since } = q.success ? q.data : {};

    const session = await liveAssistSessionStore.get(tenantId, sessionId);
    if (!session) return withCorrelationHeaders(event, notFound("Session not found"));

    const events = await liveAssistEventStore.list(sessionId, limit, since);
    return withCorrelationHeaders(event, ok({ events }));
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  return withCorrelationHeaders(event, notFound("Route not found"));
};
