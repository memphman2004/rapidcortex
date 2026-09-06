import type {
  CadConnectorConfig,
  CadHealthCheckResult,
  CadVendorId,
  CadWriteBackRequest,
  UnifiedCadIncident,
} from "rapid-cortex-shared";

export interface CadAdapter {
  readonly vendorId: CadVendorId;

  fetchIncidents(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
    sinceTimestamp?: string;
    limit?: number;
  }): Promise<CadAdapterFetchResult>;

  submitWriteBack(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
    writeBack: CadWriteBackRequest;
  }): Promise<CadAdapterWriteBackResult>;

  healthCheck(params: {
    config: CadConnectorConfig;
    credentials: ResolvedCadCredentials;
  }): Promise<CadHealthCheckResult>;

  normalize(raw: Record<string, unknown>, config: CadConnectorConfig): UnifiedCadIncident;

  translateWriteBack(
    writeBack: CadWriteBackRequest,
    config: CadConnectorConfig,
  ): Record<string, unknown>;
}

export interface ResolvedCadCredentials {
  authType: CadConnectorConfig["credentials"]["authType"];
  apiKey?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  clientCert?: string;
  clientKey?: string;
}

export interface CadAdapterFetchResult {
  incidents: UnifiedCadIncident[];
  nextToken?: string;
  fetchedAt: string;
  rawCount: number;
  normalizedCount: number;
  errors: CadAdapterFieldError[];
}

export interface CadAdapterWriteBackResult {
  success: boolean;
  vendorResponseCode?: number;
  vendorResponseBody?: string;
  errorMessage?: string;
}

export interface CadAdapterFieldError {
  field: string;
  message: string;
  rawValue?: unknown;
}

export class CadAdapterTranslationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly vendorId: CadVendorId,
  ) {
    super(message);
    this.name = "CadAdapterTranslationError";
  }
}
