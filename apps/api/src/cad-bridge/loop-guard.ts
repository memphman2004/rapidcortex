import { createHash } from "node:crypto";
import {
  buildBridgeToken,
  extractBridgeToken,
  rawBodyLooksLikeBridgeEcho,
} from "rapid-cortex-shared";
import { cadBridgeStore } from "./store.js";

export async function registerOutboundEvent(
  agencyId: string,
  eventId: string,
  contentFingerprint: string,
): Promise<string> {
  const token = buildBridgeToken(eventId);
  await cadBridgeStore.registerLoopEvent(agencyId, eventId, contentFingerprint);
  return token;
}

export async function registerOutboundFingerprint(
  agencyId: string,
  eventId: string,
  outboundBody: string,
): Promise<void> {
  await cadBridgeStore.registerLoopFingerprint(agencyId, buildContentFingerprint(outboundBody), eventId);
}

export interface LoopCheckResult {
  isLoop: boolean;
  reason?: string;
}

export async function checkForLoop(
  agencyId: string,
  rawBody: string,
  inboundEventId?: string,
): Promise<LoopCheckResult> {
  if (rawBodyLooksLikeBridgeEcho(rawBody)) {
    const embeddedEventId = extractBridgeToken(rawBody);
    if (embeddedEventId && (await cadBridgeStore.hasLoopEvent(agencyId, embeddedEventId))) {
      return { isLoop: true, reason: `embedded bridge token ${embeddedEventId}` };
    }
  }
  if (inboundEventId && (await cadBridgeStore.hasLoopEvent(agencyId, inboundEventId))) {
    return { isLoop: true, reason: `matched event ID ${inboundEventId}` };
  }
  const fingerprint = buildContentFingerprint(rawBody);
  if (await cadBridgeStore.hasLoopFingerprint(agencyId, fingerprint)) {
    return { isLoop: true, reason: "content fingerprint match" };
  }
  return { isLoop: false };
}

export function buildContentFingerprint(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}
