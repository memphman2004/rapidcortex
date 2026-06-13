import { env } from "../lib/env.js";
import { normalizePhoneE164 } from "../lib/phone-hash.js";
import { SmsRoutingRepository } from "../repositories/smsRoutingRepository.js";

const smsRoutingRepo = new SmsRoutingRepository();

/** First active inbound SMS number for an agency (tap-to-call on QR intake). */
export async function resolveAgencyCallNumber(
  agencyId: string,
  explicit?: string | null,
): Promise<string | undefined> {
  const override = explicit?.trim();
  if (override) {
    try {
      return normalizePhoneE164(override);
    } catch {
      return override;
    }
  }

  if (!env.smsRoutingTable?.trim()) return undefined;

  try {
    const rows = await smsRoutingRepo.listByAgency(agencyId);
    const active = rows.find((row) => row.active);
    return active?.phoneNumber;
  } catch {
    return undefined;
  }
}
