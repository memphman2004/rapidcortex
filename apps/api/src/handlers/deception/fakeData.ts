/**
 * All synthetic values for Deception Shield decoys and honeytoken matching.
 * Do not inline fake secrets elsewhere — import from this module only.
 */
export const HONEYTOKENS = {
  CAD_API_KEY: "cad_live_fake_aabbccdd11223344",
  RC_LITE_API_KEY: "rclite_fake_aabbccdd11223344",
  AGENCY_ID: "agency-fake-00000000",
  INCIDENT_ID: "inc-fake-00000000-0000",
  NCIC_TOKEN: "NCIC-FAKE-TOKEN-XYZ",
  ADMIN_BACKUP_TOKEN: "backup_fake_aabbccdd",
} as const;

export type HoneytokenKey = keyof typeof HONEYTOKENS;

/** Flat list of values used for request matching (never log these). */
export const HONEYTOKEN_VALUES: readonly string[] = Object.freeze(Object.values(HONEYTOKENS));

/** Decoy JSON bodies — referenced only by decoy router (no inline literals in handlers). */
export const DECOY_RESPONSES = {
  "/api/internal/cad-sync": {
    status: "ok",
    lastSync: "2024-01-15T12:00:00.000Z",
    cadVendor: "FAKE-CAD-VENDOR",
    message: "Sync queue idle (decoy)",
  },
  "/api/internal/cad-writeback": {
    status: "queued",
    writebackId: "wb_fake_00000000",
    cadAck: "pending",
  },
  "/api/internal/ncic-gateway": {
    status: "connected",
    records: 0,
    token: "NCIC-FAKE-TOKEN-XYZ",
  },
  "/api/internal/agency-root": {
    agencies: [{ id: HONEYTOKENS.AGENCY_ID, name: "FAKE AGENCY ROOT", status: "active" }],
  },
  "/api/admin-backup": {
    backupSlot: "slot-fake-01",
    tokenPreview: "backup_fake_…",
    nextRun: "2099-01-01T00:00:00.000Z",
  },
  "/api/rc-lite/root": {
    service: "rc-lite",
    version: "0.0.0-fake",
    apiKeyPreview: "rclite_fake_…",
  },
  "/api/system/secrets": {
    apiKey: "rclite_fake_aabbcc112233...",
    cadToken: "CAD-FAKE-TOKEN-...",
    rotationDue: false,
  },
  "/api/debug/env": {
    NODE_ENV: "production",
    DB_HOST: "db-prod-fake.internal",
    REGION: "us-east-1",
  },
  "/api/v1/cad/export-test": {
    format: "json",
    rows: 0,
    exportId: "exp_fake_00000000",
  },
} as const satisfies Record<string, Record<string, unknown>>;
