import type { RapidSosLocationCandidate } from "./types.js";

export type { RapidSosLocationCandidate };

/**
 * Read-only RapidSOS context. Never blocks the call. Location is a candidate only.
 */
export async function lookupRapidSosLocation(opts: {
  agencyId: string;
  ani?: string;
  mock: boolean;
}): Promise<RapidSosLocationCandidate | null> {
  try {
    if (opts.mock || !opts.ani) return null;
    return null;
  } catch {
    return null;
  }
}
