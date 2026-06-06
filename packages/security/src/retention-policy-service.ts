// TODO(prod) — Section 9.1: wire scheduled purge Lambda + TTL jobs; policy storage alone is insufficient for CJIS lifecycle.

export type RetentionPolicy = {
  policyId: string;
  agencyId: string;
  transcriptRetentionDays: number;
  analysisRetentionDays: number;
  auditRetentionDays: number;
  legalHold: boolean;
  updatedAt: string;
};

/** TTL / purge hooks — persistence implemented per agency in Dynamo jobs. */
export class RetentionPolicyService {
  getDefaultPolicy(agencyId: string): RetentionPolicy {
    const now = new Date().toISOString();
    return {
      policyId: `default-${agencyId}`,
      agencyId,
      transcriptRetentionDays: 365,
      analysisRetentionDays: 730,
      auditRetentionDays: 2555,
      legalHold: false,
      updatedAt: now,
    };
  }

  validate(policy: RetentionPolicy): string[] {
    const issues: string[] = [];
    if (policy.transcriptRetentionDays < 1) issues.push("transcriptRetentionDays must be >= 1");
    if (policy.legalHold && policy.transcriptRetentionDays < 1)
      issues.push("legalHold requires explicit policy review");
    return issues;
  }
}
