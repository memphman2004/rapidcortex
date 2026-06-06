// TODO(prod) — Section 2.6 / 9: add regression tests asserting prod flags flip `redactTranscriptInAudit` / `kmsAtRestRequired`; verify runtime enforcement consumes these flags in API middleware.

export type ComplianceFeatureFlags = {
  /** When true, audit log lines omit raw transcript text. */
  redactTranscriptInAudit: boolean;
  /** When true, expect KMS CMKs on sensitive tables (GovCloud path). */
  kmsAtRestRequired: boolean;
  /** When true, API refuses non-TLS upstreams. */
  enforceTls: boolean;
  /** Secrets only via AWS Secrets Manager / SSM — never env literals in prod. */
  secretsManagerBoundary: boolean;
};

export class ComplianceConfigService {
  getFlagsForEnvironment(envName: string): ComplianceFeatureFlags {
    const prod = envName === "production" || envName === "prod";
    return {
      redactTranscriptInAudit: prod,
      kmsAtRestRequired: prod,
      enforceTls: true,
      secretsManagerBoundary: prod,
    };
  }
}
