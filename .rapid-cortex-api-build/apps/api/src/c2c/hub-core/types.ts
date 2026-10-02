import type { EidoEnvelope } from "../eido/types.js";
import type { AgencyConfig, TransferDecision } from "../transfer-rules/engine.js";

export type C2CMessageType =
  | "NEW_INCIDENT"
  | "INCIDENT_UPDATE"
  | "UNIT_STATUS_UPDATE"
  | "TRANSFER_REQUEST"
  | "DISPATCH_CONFIRMATION";

export interface RoutingTargetResult {
  agencyId: string;
  ok: boolean;
  error?: string;
  nativeIncidentId?: string;
}

export interface RoutingResult {
  hubMessageId: string;
  incidentId: string;
  sourceAgencyId: string;
  targets: RoutingTargetResult[];
  decisions: TransferDecision[];
}

export interface FanOutResult {
  targets: RoutingTargetResult[];
}

export interface HubIncidentLink {
  hubIncidentId: string;
  agencyId: string;
  nativeIncidentId: string;
  status: string;
  eido: EidoEnvelope;
}

export type { AgencyConfig };
