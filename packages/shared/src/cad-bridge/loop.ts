import { RC_BRIDGE_COMMENT_PREFIX } from "./schemas.js";

const TOKEN_RE = /\[RC-BRIDGE:([a-f0-9-]+)\]/i;
const STRIP_RE = /\n?\[RC-BRIDGE:[a-f0-9-]+\]/gi;

export function extractBridgeToken(text: string): string | undefined {
  const match = text.match(TOKEN_RE);
  return match?.[1];
}

export function buildBridgeToken(eventId: string): string {
  return `${RC_BRIDGE_COMMENT_PREFIX}${eventId}]`;
}

export function buildBridgedCommentText(originalText: string, bridgeToken: string): string {
  return `${originalText}\n${bridgeToken}`;
}

export function stripBridgeToken(text: string): string {
  return text.replace(STRIP_RE, "").trim();
}

export function rawBodyLooksLikeBridgeEcho(rawBody: string): boolean {
  return rawBody.includes(RC_BRIDGE_COMMENT_PREFIX);
}
