/** Billable unit types for RC Lite usage meters. */
export const RC_LITE_BILLABLE_UNIT_TYPES = [
  "api_call",
  "audio_minute",
  "translation_minute",
  "media_session",
  "cad_export",
  "qa_analysis",
  "webhook_delivery",
] as const;

export type RcLiteBillableUnitType = (typeof RC_LITE_BILLABLE_UNIT_TYPES)[number];

export type RcLiteUsageRecord = {
  tenantId: string;
  apiKeyId: string;
  endpoint: string;
  productModule: string;
  billableUnitType: RcLiteBillableUnitType;
  billableUnits: number;
  statusCode: number;
  success: boolean;
  latencyMs: number;
  requestId: string;
  timestamp: string;
  /** Replay of an earlier successful mutation — excludes duplicate billed units when policy applies. */
  idempotentReplay?: boolean;
};
