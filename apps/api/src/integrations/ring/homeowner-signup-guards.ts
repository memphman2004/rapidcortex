import * as bcrypt from "bcryptjs";
import type { RingRequestStatus } from "../../lib/ring-integration.js";
import { RingEmergencyRepository } from "../../repositories/ringEmergencyRepository.js";

/** Known throwaway inboxes — keep the public error generic. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwam.com",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "spam4.me",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "dispostable.com",
  "maildrop.cc",
  "discard.email",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "10minutemail.com",
  "10minutemail.net",
  "tempr.email",
  "fakeinbox.com",
]);

/** Dispatcher SMS request statuses that prove a real consent invite (PENDING is a legacy alias for OPENED). */
const CONSENTABLE_STATUSES: readonly RingRequestStatus[] = ["SENT", "OPENED"];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return true;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Prove signup was kicked off by a dispatcher consent SMS.
 * Tokens are stored as bcrypt hashes on RingEmergencyCameraRequests (PK agencyIncidentKey + requestId),
 * not as a GetItem Key `{ token }`.
 */
export async function validateConsentToken(
  token: string,
  repo: RingEmergencyRepository = new RingEmergencyRepository(),
  nowMs = Date.now(),
): Promise<boolean> {
  const plain = token.trim();
  if (plain.length < 16) return false;

  for (const status of CONSENTABLE_STATUSES) {
    const candidates = await repo.listRequestsByStatus(status, nowMs);
    for (const candidate of candidates) {
      if (!candidate.requestTokenHash) continue;
      const match = await bcrypt.compare(plain, candidate.requestTokenHash);
      if (!match) continue;
      const exp = new Date(candidate.expiresAt).getTime();
      if (Number.isFinite(exp) && exp < nowMs) return false;
      const statusRaw = String(candidate.requestStatus ?? "");
      if (statusRaw !== "SENT" && statusRaw !== "OPENED" && statusRaw !== "PENDING") return false;
      return true;
    }
  }
  return false;
}
