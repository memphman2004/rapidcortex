export type CadVendor =
  | "motorola"
  | "centralsquare"
  | "tyler"
  | "hexagon"
  | "generic"
  | "mock";

export type CadMode = "disabled" | "read_only" | "assisted_writeback";

export type CadApprovalStatus = "pending" | "approved" | "rejected";

export type CadWriteAction =
  | "addNarrativeNote"
  | "attachMediaLink"
  | "updateDisposition"
  | "dispatchUnit"
  | "changePriority"
  | "closeIncident"
  | "deleteIncident";

export type CadConnectionConfig = {
  agencyId: string;
  vendor: CadVendor;
  mode: CadMode;
  apiBaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  timeoutMs: number;
  writebackEnabled: boolean;
  mockFailureRate: number;
};

export type CadIncident = {
  agencyId: string;
  incidentId: string;
  externalCadId?: string;
  callType?: string;
  priority?: string;
  callerName?: string;
  callerPhone?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  narrative?: string;
  summary?: string;
  mediaUrls?: string[];
  createdAt: string;
  updatedAt: string;
  status: string;
};

export type CadIncidentDraft = {
  agencyId: string;
  incidentId: string;
  draftId: string;
  summary: string;
  narrative?: string;
  status: "draft";
  createdAt: string;
  updatedAt: string;
};

export type CadNarrativeNote = {
  agencyId: string;
  incidentId: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type CadMediaLink = {
  agencyId: string;
  incidentId: string;
  mediaUrl: string;
  mediaType?: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type CadDispositionUpdate = {
  agencyId: string;
  incidentId: string;
  disposition: string;
  reason?: string;
  updatedBy: string;
  updatedAt: string;
};

export type CadAdapterError = {
  code:
    | "NOT_CONFIGURED"
    | "VALIDATION_ERROR"
    | "CONNECTION_ERROR"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "MOCK_FAILURE"
    | "UNKNOWN_ERROR";
  message: string;
  details?: Record<string, unknown>;
};

export type CadAdapterResult<T> = {
  ok: boolean;
  vendor: CadVendor;
  data?: T;
  error?: CadAdapterError;
};

export type CadAuditEvent = {
  agencyId: string;
  userId: string;
  incidentId?: string;
  cadVendor: CadVendor;
  action: CadWriteAction | "healthCheck" | "searchIncidents" | "getIncident";
  requestPayload?: Record<string, unknown>;
  resultStatus: "success" | "failed" | "blocked";
  errorMessage?: string;
  timestamp: string;
  approvalStatus?: CadApprovalStatus;
  approvedBy?: string;
};

export type CadWriteBackRequest = {
  agencyId: string;
  incidentId: string;
  action: CadWriteAction;
  approvalStatus: CadApprovalStatus;
  approvedBy?: string;
  requestedBy: string;
  requestPayload: Record<string, unknown>;
  requestedAt?: string;
};
