import { env } from "../../lib/env.js";

export function configureRingEmergencyTables(): void {
  if (env.ringAccountsTable) process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  if (env.ringDevicesTable) process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  if (env.ringRequestsTable) process.env.RING_TABLE_REQUESTS = env.ringRequestsTable;
  if (env.ringSessionsTable) process.env.RING_TABLE_SESSIONS = env.ringSessionsTable;
}
