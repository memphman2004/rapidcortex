import { env } from "./env.js";
import { SmsRoutingRepository } from "../repositories/smsRoutingRepository.js";

/**
 * Per-agency outbound sender. Agencies text residents from their own local number so the
 * message is recognizable, and so one agency's traffic is not attributed to another's sender.
 *
 * Falls back to `null` (shared Messaging Service) when the routing table is not configured for
 * this Lambda or the agency has no active number — never blocks a send, since these are
 * emergency-path messages.
 */

const CACHE_TTL_MS = 60_000;

type CacheEntry = { sender: string | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const repo = new SmsRoutingRepository();

/** Test seam — Lambda containers are long-lived, so the cache must be clearable. */
export function resetAgencySenderCache(): void {
  cache.clear();
}

export async function resolveAgencySender(agencyId: string): Promise<string | null> {
  if (!agencyId.trim() || !env.smsRoutingTable.trim()) return null;

  const cached = cache.get(agencyId);
  if (cached && cached.expiresAt > Date.now()) return cached.sender;

  let sender: string | null = null;
  try {
    const rows = await repo.listByAgency(agencyId);
    const owned = rows
      // The GSI is already keyed by agencyId; re-checking keeps a malformed row from ever
      // letting one tenant send as another.
      .filter((row) => row.active && row.agencyId === agencyId && row.phoneNumber?.trim())
      .sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));
    sender = owned[0]?.phoneNumber ?? null;
  } catch (err) {
    console.error(
      JSON.stringify({
        type: "outbound.sms",
        event: "agency_sender_lookup_failed",
        agencyId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    sender = null;
  }

  cache.set(agencyId, { sender, expiresAt: Date.now() + CACHE_TTL_MS });
  return sender;
}
