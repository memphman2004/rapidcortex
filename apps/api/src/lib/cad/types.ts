import type { CadConnectionType, CadVendor } from "rapid-cortex-shared";
import type { CadAlert, CadAniAliSource, CadLocationSource, CadPriority, CadUnitAssignment } from "rapid-cortex-shared";

export type { CadPriority };

/** Minimal integration context for vendor-specific setup copy (URLs, headers, field hints). */
export type CadIntegrationSetupContext = {
  id: string;
  agencyId: string;
  name: string;
  vendor: CadVendor;
  webhookUrl: string;
  connectionType?: CadConnectionType;
  config?: Record<string, unknown>;
  /** When showing a freshly issued token, pass last few characters; else masked placeholder. */
  tokenPreview?: string;
};

export interface NormalizedCadIncident {
  cadNumber: string;
  incidentType: string;
  priority: CadPriority;
  location: string;
  callerCallback?: string;
  callerName?: string;
  units: string[];
  coordinates?: { lat: number; lng: number };
  notes?: string;
  /** Vendor incident lifecycle (e.g. DISPATCHED, CLOSED) when provided. */
  cadStatus?: string;
  /** Monotonic vendor revision when provided (else treated as 0). */
  revision?: number;
  rawPayload: unknown;
  priorityModifier?: string;
  disposition?: string;
  intersection?: string;
  beat?: string;
  zone?: string;
  jurisdiction?: string;
  locationConfidence?: string;
  locationSource?: CadLocationSource;
  callerAddress?: string;
  aniAliSource?: CadAniAliSource;
  relatedCadNumbers?: string[];
  duplicateOfCadNumber?: string;
  unitDetails?: CadUnitAssignment[];
  alerts?: CadAlert[];
}

export interface CadParser {
  vendor: CadVendor;
  parse(rawPayload: unknown): NormalizedCadIncident;
  validate(rawPayload: unknown): boolean;
  generateSetupInstructions(integration: CadIntegrationSetupContext): string;
}
