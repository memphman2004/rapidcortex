/**
 * Sentinel tenant id for Cognito `custom:agencyId` when `custom:role` is `rcsuperadmin` (or legacy tokens that migrate to it).
 * Never use as a partition for customer incidents in production without explicit guards.
 */
export const PLATFORM_AGENCY_ID = "__platform__" as const;

export type PlatformAgencyId = typeof PLATFORM_AGENCY_ID;
