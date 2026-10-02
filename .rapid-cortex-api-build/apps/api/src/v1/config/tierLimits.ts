import type { RcLiteKeyTier } from "rapid-cortex-shared";

/** Defaults applied when provisioning keys; mirrored on usage records for billing. */
export const RC_LITE_TIER_LIMITS: Record<
  RcLiteKeyTier,
  {
    monthlyCallLimit: number;
    rateLimitPerMinute: number;
    maxWebhooks: number;
    maxCredentials: number;
    dataRetentionDays: number;
    sandboxOnly: boolean;
  }
> = {
  dev: {
    monthlyCallLimit: 1_000,
    rateLimitPerMinute: 10,
    maxWebhooks: 5,
    maxCredentials: 2,
    dataRetentionDays: 30,
    sandboxOnly: true,
  },
  small: {
    monthlyCallLimit: 25_000,
    rateLimitPerMinute: 100,
    maxWebhooks: 25,
    maxCredentials: 5,
    dataRetentionDays: 90,
    sandboxOnly: false,
  },
  medium: {
    monthlyCallLimit: 100_000,
    rateLimitPerMinute: 500,
    maxWebhooks: 100,
    maxCredentials: 10,
    dataRetentionDays: 365,
    sandboxOnly: false,
  },
  large: {
    monthlyCallLimit: 500_000,
    rateLimitPerMinute: 2_000,
    maxWebhooks: 250,
    maxCredentials: 25,
    dataRetentionDays: 1095,
    sandboxOnly: false,
  },
  enterprise: {
    monthlyCallLimit: Number.MAX_SAFE_INTEGER,
    rateLimitPerMinute: 10_000,
    maxWebhooks: 999,
    maxCredentials: 999,
    dataRetentionDays: 2555,
    sandboxOnly: false,
  },
};

export const RC_LITE_OVERAGE_RATES_PER_1K: Record<RcLiteKeyTier, number> = {
  dev: 0.5,
  small: 0.1,
  medium: 0.08,
  large: 0.05,
  enterprise: 0,
};
