import { ulid } from "ulid";
import type {
  IncidentLocationEntry,
  LocateSubmitBody,
  LocateTokenPublicView,
  LocationSource,
} from "rapid-cortex-shared";
import { locateSubmitBodySchema } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";
import { makeId } from "../lib/ids.js";
import { PublicBurstLimiter } from "../lib/publicRateLimiter.js";
import { LocationTokenRepository } from "../repositories/locationTokenRepository.js";
import { WebSocketNotificationService } from "./websocketNotificationService.js";
import { sendIncidentMediaLinkSms } from "./sms/smsProviderFactory.js";
import {
  appendCampusIncidentLocation,
  appendCampusSmsChatMessage,
} from "../campus/campus-incident-service.js";

const tokenRepo = new LocationTokenRepository();
const ws = new WebSocketNotificationService();
const submitLimiter = new PublicBurstLimiter(5, 30 * 60 * 1000);

const TOKEN_TTL_MINUTES = 30;

function publicBaseUrl(): string {
  return (
    env.locatePublicBaseUrl?.replace(/\/$/, "") ||
    env.appPublicBaseUrl?.replace(/\/$/, "") ||
    env.pinpointPublicBaseUrl?.replace(/\/$/, "") ||
    ""
  );
}

function smsFactoryEnv() {
  return {
    smsProvider: env.smsProvider,
    smsPrimaryProvider: env.smsPrimaryProvider,
    deploymentStage: env.deploymentStage,
    incidentMediaSmsMock: env.incidentMediaSmsMock || env.locateSmsMock,
    mockSmsProvider: env.mockSmsProvider,
    awsRegion: env.region,
    awsSmsRegion: env.awsSmsRegion,
    awsSmsUseSimulator: env.awsSmsUseSimulator,
    twilioSecretArn: env.incidentMediaTwilioSecretArn,
    awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
    awsSmsPoolId: env.awsSmsPoolId,
  };
}

function autoReplyMessage(vertical: "campus" | "venue", token: string, base: string): string {
  const host = base.replace(/^https?:\/\//, "");
  const link = `${host}/locate/${token}`;
  if (vertical === "venue") {
    return `Venue Security has your message. Tap to share your location: ${link}`;
  }
  return `Campus Security has your message. Tap to share your location: ${link}`;
}

export class SmsLocationService {
  async createAndSendLocationLink(params: {
    incidentId: string;
    agencyId: string;
    phoneHash: string;
    callerPhoneE164: string;
    vertical: "campus" | "venue";
  }): Promise<{ token: string; publicUrl: string }> {
    if (!env.locationTokensTable) throw new Error("LOCATION_TOKENS_TABLE_NOT_CONFIGURED");
    const base = publicBaseUrl();
    if (!base) throw new Error("MISSING_PUBLIC_BASE_URL");

    const token = ulid();
    const now = new Date();
    const createdAt = now.toISOString();
    const ttl = Math.floor(now.getTime() / 1000) + TOKEN_TTL_MINUTES * 60;

    await tokenRepo.put({
      token,
      incidentId: params.incidentId,
      agencyId: params.agencyId,
      phoneHash: params.phoneHash,
      vertical: params.vertical,
      status: "PENDING",
      source: "GPS",
      createdAt,
      ttl,
    });

    const publicUrl = `${base}/locate/${encodeURIComponent(token)}`;
    const messageBody = autoReplyMessage(params.vertical, token, base);

    await sendIncidentMediaLinkSms(smsFactoryEnv(), {
      toPhoneE164: params.callerPhoneE164,
      messageBody,
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      messageType: "sms_location",
    });

    await incidentTimelineLogger.emit({
      incidentId: params.incidentId,
      agencyId: params.agencyId,
      kind: "auto_reply_sent",
      source: "system",
      payload: { channel: "sms", linkSent: true },
    });

    return { token, publicUrl };
  }

  async applyCarrierLocation(params: {
    incidentId: string;
    agencyId: string;
    campusCode: string;
    coordinates: { latitude: number; longitude: number; accuracy: number };
  }): Promise<void> {
    const receivedAt = new Date().toISOString();
    const entry: IncidentLocationEntry = {
      source: "CELL_TOWER",
      accuracyMeters: params.coordinates.accuracy,
      receivedAt,
      coordinates: params.coordinates,
    };

    await appendCampusIncidentLocation(params.campusCode, params.incidentId, entry);

    await incidentTimelineLogger.emit({
      incidentId: params.incidentId,
      agencyId: params.agencyId,
      kind: "location_received",
      source: "system",
      payload: {
        source: "CELL_TOWER",
        accuracyMeters: params.coordinates.accuracy,
        receivedAt,
      },
    });

    await ws.broadcastLocationReceived({
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      source: "CELL_TOWER",
      coordinates: params.coordinates,
      accuracyMeters: params.coordinates.accuracy,
      receivedAt,
    });
  }

  async getPublicToken(token: string): Promise<LocateTokenPublicView> {
    if (!env.locationTokensTable) throw new Error("LOCATION_TOKENS_TABLE_NOT_CONFIGURED");
    const row = await tokenRepo.getByToken(token);
    if (!row) return { valid: false, status: "EXPIRED", vertical: "campus" };

    const expired = row.ttl * 1000 < Date.now() || row.status === "EXPIRED";
    if (expired) return { valid: false, status: "EXPIRED", vertical: row.vertical };

    return {
      valid: row.status === "PENDING" || row.status === "RECEIVED",
      status: row.status,
      vertical: row.vertical,
    };
  }

  async submitLocation(token: string, rawBody: unknown): Promise<{ received: true }> {
    if (!env.locationTokensTable) throw new Error("LOCATION_TOKENS_TABLE_NOT_CONFIGURED");
    if (!submitLimiter.allow(token)) throw new Error("RATE_LIMITED");

    const body = locateSubmitBodySchema.parse(rawBody) as LocateSubmitBody;
    const row = await tokenRepo.getByToken(token);
    if (!row) throw new Error("NOT_FOUND");
    if (row.status !== "PENDING") throw new Error("ALREADY_USED");
    if (row.ttl * 1000 < Date.now()) throw new Error("EXPIRED");

    const receivedAt = new Date().toISOString();
    const hasCoords =
      body.latitude != null && body.longitude != null && Number.isFinite(body.latitude) && Number.isFinite(body.longitude);

    if (hasCoords) {
      const source: LocationSource = body.source === "MANUAL" ? "MANUAL" : "GPS";
      const accuracy = body.accuracy ?? 25;
      const coordinates = {
        latitude: body.latitude!,
        longitude: body.longitude!,
        accuracy,
        altitude: body.altitude,
      };

      const updated = await tokenRepo.markReceived(token, {
        status: "RECEIVED",
        source,
        coordinates,
        receivedAt,
      });
      if (!updated) throw new Error("ALREADY_USED");

      const entry: IncidentLocationEntry = {
        source,
        accuracyMeters: accuracy,
        receivedAt,
        coordinates,
      };

      const campusCode = row.agencyId;
      await appendCampusIncidentLocation(campusCode, row.incidentId, entry);

      await incidentTimelineLogger.emit({
        incidentId: row.incidentId,
        agencyId: row.agencyId,
        kind: "location_received",
        source: "system",
        payload: { source, accuracyMeters: accuracy, receivedAt },
      });

      await ws.broadcastLocationReceived({
        agencyId: row.agencyId,
        incidentId: row.incidentId,
        source,
        coordinates,
        accuracyMeters: accuracy,
        receivedAt,
      });

      return { received: true };
    }

    if (body.locationText?.trim()) {
      const updated = await tokenRepo.markReceived(token, {
        status: "RECEIVED",
        source: "MANUAL",
        locationText: body.locationText.trim(),
        receivedAt,
      });
      if (!updated) throw new Error("ALREADY_USED");

      const entry: IncidentLocationEntry = {
        source: "MANUAL",
        receivedAt,
        locationText: body.locationText.trim(),
      };

      await appendCampusIncidentLocation(row.agencyId, row.incidentId, entry);

      await incidentTimelineLogger.emit({
        incidentId: row.incidentId,
        agencyId: row.agencyId,
        kind: "location_received",
        source: "system",
        payload: { source: "MANUAL", text: body.locationText.trim(), receivedAt },
      });

      await ws.broadcastLocationReceived({
        agencyId: row.agencyId,
        incidentId: row.incidentId,
        source: "MANUAL",
        locationText: body.locationText.trim(),
        receivedAt,
      });

      return { received: true };
    }

    throw new Error("VALIDATION:coordinates or locationText required");
  }
}

export const smsLocationService = new SmsLocationService();

export async function recordManualLocationReply(params: {
  campusCode: string;
  incidentId: string;
  agencyId: string;
  locationText: string;
}): Promise<void> {
  const receivedAt = new Date().toISOString();
  const entry: IncidentLocationEntry = {
    source: "MANUAL",
    receivedAt,
    locationText: params.locationText,
  };
  await appendCampusIncidentLocation(params.campusCode, params.incidentId, entry);
  await incidentTimelineLogger.emit({
    incidentId: params.incidentId,
    agencyId: params.agencyId,
    kind: "location_received",
    source: "system",
    payload: { source: "MANUAL", text: params.locationText, receivedAt },
  });
  await ws.broadcastLocationReceived({
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    source: "MANUAL",
    locationText: params.locationText,
    receivedAt,
  });
}

export async function recordCampusChatMessage(params: {
  campusCode: string;
  incidentId: string;
  agencyId: string;
  messageBody: string;
}): Promise<void> {
  await appendCampusSmsChatMessage(params.campusCode, params.incidentId, params.messageBody);
  await incidentTimelineLogger.emit({
    incidentId: params.incidentId,
    agencyId: params.agencyId,
    kind: "chat_message_received",
    source: "system",
    payload: { text: params.messageBody },
  });
  await ws.broadcastChatMessage({
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    messageBody: params.messageBody,
  });
}
