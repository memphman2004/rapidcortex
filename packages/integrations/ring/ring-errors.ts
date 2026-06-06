export type RingErrorMetadata = Record<string, unknown>;

export class RingIntegrationError extends Error {
  readonly code: string;
  readonly metadata?: RingErrorMetadata;

  constructor(
    message: string,
    code = "RING_INTEGRATION_ERROR",
    metadata?: RingErrorMetadata,
  ) {
    super(message);
    this.name = "RingIntegrationError";
    this.code = code;
    this.metadata = metadata;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      ...(this.metadata !== undefined ? { metadata: this.metadata } : {}),
    };
  }
}

export class RingAuthError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_AUTH_ERROR", metadata);
    this.name = "RingAuthError";
  }
}

export class RingTokenExpiredError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_TOKEN_EXPIRED", metadata);
    this.name = "RingTokenExpiredError";
  }
}

export class RingDeviceDiscoveryError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_DEVICE_DISCOVERY_ERROR", metadata);
    this.name = "RingDeviceDiscoveryError";
  }
}

export class RingConsentError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_CONSENT_ERROR", metadata);
    this.name = "RingConsentError";
  }
}

export class RingSessionError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_SESSION_ERROR", metadata);
    this.name = "RingSessionError";
  }
}

export class RingFeatureDisabledError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_FEATURE_DISABLED", metadata);
    this.name = "RingFeatureDisabledError";
  }
}

export class RingAgencyIsolationError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_AGENCY_ISOLATION_ERROR", metadata);
    this.name = "RingAgencyIsolationError";
  }
}

export class RingRateLimitError extends RingIntegrationError {
  constructor(message: string, metadata?: RingErrorMetadata) {
    super(message, "RING_RATE_LIMIT_ERROR", metadata);
    this.name = "RingRateLimitError";
  }
}
