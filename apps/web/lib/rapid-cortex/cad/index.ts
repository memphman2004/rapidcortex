export type { CadIncidentRecord, CadUnitRecord, CadEventRecord } from "@/lib/rapid-cortex/cad/cad-models";
export type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
export { StagingCadReadAdapter } from "@/lib/rapid-cortex/cad/staging-cad-read-adapter";
export { MotorolaCadReadAdapter } from "@/lib/rapid-cortex/cad/motorola-cad-read-adapter";
export { BridgedCadReadAdapter } from "@/lib/rapid-cortex/cad/bridged-cad-read-adapter";

export type { CadAdapter } from "@/lib/rapid-cortex/cad/CadAdapter";
export { DisabledCadAdapter } from "@/lib/rapid-cortex/cad/DisabledCadAdapter";
export { ReadOnlyCadAdapter } from "@/lib/rapid-cortex/cad/ReadOnlyCadAdapter";
export { MotorolaPremierOneCadAdapter } from "@/lib/rapid-cortex/cad/vendors/MotorolaPremierOneCadAdapter";
export { resolveCadAdapter, resolveCadReadProvider } from "@/lib/rapid-cortex/cad/CadAdapterFactory";

export type {
  CadApprovalStatus,
  CadAuditEvent,
  CadAdapterError,
  CadAdapterResult,
  CadConnectionConfig,
  CadDispositionUpdate,
  CadIncident,
  CadIncidentDraft,
  CadMediaLink,
  CadMode,
  CadNarrativeNote,
  CadVendor,
  CadWriteAction,
  CadWriteBackRequest,
} from "@/lib/rapid-cortex/cad/types";
export type { CadAdapter as VendorCadAdapter, CadIncidentSearchQuery } from "@/lib/rapid-cortex/cad/cad-adapter";
export { CadAdapterFactory, readCadConnectionConfig } from "@/lib/rapid-cortex/cad/cad-adapter-factory";
export { MockCadAdapter } from "@/lib/rapid-cortex/cad/adapters/mock-cad-adapter";
export { MotorolaCadAdapter } from "@/lib/rapid-cortex/cad/adapters/motorola-adapter";
export { CentralsquareCadAdapter } from "@/lib/rapid-cortex/cad/adapters/centralsquare-adapter";
export { TylerCadAdapter } from "@/lib/rapid-cortex/cad/adapters/tyler-adapter";
export { HexagonCadAdapter } from "@/lib/rapid-cortex/cad/adapters/hexagon-adapter";
export { GenericCadAdapter } from "@/lib/rapid-cortex/cad/adapters/generic-cad-adapter";
export { CadAuditService } from "@/lib/rapid-cortex/cad/audit/cad-audit-service";
export { CadWritebackService } from "@/lib/rapid-cortex/cad/writeback/cad-writeback-service";
