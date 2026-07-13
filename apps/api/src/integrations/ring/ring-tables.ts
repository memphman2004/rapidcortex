import { env } from "../../lib/env.js";

/**
 * Mirrors Ring table names from Lambda env into process.env for the integrations package.
 * Staff handlers (login, consent, request-camera-access) call this at entry; citizen-only
 * keys (e.g. RING_TABLE_CITIZEN_OWNERS) are set here but unused on staff code paths.
 */
export function configureRingEmergencyTables(): void {
  if (env.ringAccountsTable) process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  if (env.ringDevicesTable) process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  if (env.ringRequestsTable) process.env.RING_TABLE_REQUESTS = env.ringRequestsTable;
  if (env.ringSessionsTable) process.env.RING_TABLE_SESSIONS = env.ringSessionsTable;
  if (env.ringCitizenOwnersTable) {
    process.env.RING_TABLE_CITIZEN_OWNERS = env.ringCitizenOwnersTable;
  }
  if (env.ringHomeownerParticipantsTable) {
    process.env.RING_TABLE_HOMEOWNER_PARTICIPANTS = env.ringHomeownerParticipantsTable;
  }
  if (env.ringUnclaimedTokensTable) {
    process.env.RING_TABLE_UNCLAIMED_TOKENS = env.ringUnclaimedTokensTable;
  }
}
