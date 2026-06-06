import { randomBytes } from "node:crypto";

/**
 * Cryptographically secure random token (hex).
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Pinpoint opaque token — 64 hex chars. */
export function generatePinpointToken(): string {
  return generateSecureToken(32);
}
