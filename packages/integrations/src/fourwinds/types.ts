export type FourwindsScopeType = "campus" | "building" | "zone";

export type FourwindsDisplayScope = {
  scopeType: FourwindsScopeType;
  scopeId: string;
  label?: string;
};

export type FourwindsEmergencyPayload = {
  incidentId: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  scopes: FourwindsDisplayScope[];
  html5FallbackUrl?: string;
  allClear?: boolean;
};

export type FourwindsDispatchResult = {
  ok: boolean;
  mocked: boolean;
  providerRequestId?: string;
  error?: string;
  html5FallbackIssued?: boolean;
};
