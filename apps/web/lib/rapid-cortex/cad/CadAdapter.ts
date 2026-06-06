export type CadHealthResult = {
  ok: boolean;
  mode: "disabled" | "read_only" | "assisted_writeback" | "automated_writeback";
  provider: string;
  detail: string;
};

export type CadIncident = {
  incidentId: string;
  externalId?: string;
  status?: string;
  callType?: string;
  location?: string;
  units?: string[];
  lastUpdatedAt?: string;
  raw?: Record<string, unknown>;
};

export type CadSearchQuery = {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
};

export type CadDraftUpdateInput = {
  incidentId: string;
  summary: string;
  fields: Record<string, unknown>;
  source: "ai" | "dispatcher" | "hybrid";
};

export type CadDraftUpdate = {
  incidentId: string;
  draftId: string;
  payload: Record<string, unknown>;
};

export type CadApprovedUpdateInput = {
  incidentId: string;
  draftId: string;
  approvedByUserId: string;
  approvalNote?: string;
};

export type CadWriteResult = {
  ok: boolean;
  incidentId: string;
  vendorReferenceId?: string;
  message: string;
};

export interface CadAdapter {
  healthCheck(): Promise<CadHealthResult>;
  getIncident(incidentId: string): Promise<CadIncident>;
  searchIncidents(query: CadSearchQuery): Promise<CadIncident[]>;
  createDraftUpdate(input: CadDraftUpdateInput): Promise<CadDraftUpdate>;
  submitApprovedUpdate(input: CadApprovedUpdateInput): Promise<CadWriteResult>;
}
