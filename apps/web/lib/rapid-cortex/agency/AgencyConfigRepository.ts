import type { AgencyConfigRecord } from "@/lib/rapid-cortex/agency/defaultAgencyConfig";

export type AgencyConfigPatch = Partial<
  Omit<AgencyConfigRecord, "agencyId" | "createdAt" | "updatedAt" | "updatedBy">
>;

export interface AgencyConfigRepository {
  getAgencyConfig(agencyId: string): Promise<AgencyConfigRecord | null>;
  upsertAgencyConfig(config: AgencyConfigRecord): Promise<AgencyConfigRecord>;
  patchAgencyConfig(agencyId: string, patch: AgencyConfigPatch, updatedBy?: string): Promise<AgencyConfigRecord>;
  enableFeature(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord>;
  disableFeature(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord>;
  enableAddOn(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord>;
  disableAddOn(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord>;
}
