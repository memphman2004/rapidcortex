export const RING_TABLE_NAMES = {
  ACCOUNTS: process.env.RING_TABLE_ACCOUNTS ?? "RapidCortexRingAccounts",
  DEVICES: process.env.RING_TABLE_DEVICES ?? "RapidCortexRingDevices",
  REQUESTS: process.env.RING_TABLE_REQUESTS ?? "RingEmergencyCameraRequests",
  SESSIONS: process.env.RING_TABLE_SESSIONS ?? "RingEmergencyCameraSessions",
} as const;

export type RingTableNameKey = keyof typeof RING_TABLE_NAMES;
