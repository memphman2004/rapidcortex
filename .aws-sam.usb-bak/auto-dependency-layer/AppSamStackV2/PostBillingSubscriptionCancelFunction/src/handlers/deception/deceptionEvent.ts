import type { HoneytokenKey } from "./fakeData.js";

export type DeceptionEventType = "DECOY_ROUTE_HIT" | "HONEYTOKEN_USED" | "CROSS_CONTAMINATION" | "AUTH_CONTEXT_TOUCH";

export type DeceptionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DeceptionEvent {
  id: string;
  eventType: DeceptionEventType;
  riskLevel: DeceptionRiskLevel;
  route: string;
  method: string;
  sourceIp: string;
  userAgent: string;
  requestFingerprint: string;
  actorUserId?: string;
  actorAgencyId?: string;
  honeytokenUsed?: HoneytokenKey | string;
  payloadSummary: string;
  headersSummary: string;
  querySummary: string;
  correlationId: string;
  touchedRealRouteRecently: boolean;
  createdAt: string;
  ttl: number;
}
