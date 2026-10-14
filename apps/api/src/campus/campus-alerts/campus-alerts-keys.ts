/** Dynamo keys for Campus Alerts subscriptions (CampusIncidentsTable). */
export const CAMPUS_ALERTS_KEYS = {
  agencyPk: (agencyId: string) => `AGENCY#${agencyId}`,
  subscriptionSk: (subscriptionId: string) => `CASUB#${subscriptionId}`,
  phoneIndexSk: (phoneLookupDigest: string) => `CASUB_PHONE#${phoneLookupDigest}`,
  challengePk: (challengeId: string) => `CASUB_CHAL#${challengeId}`,
  challengeSk: () => "CHALLENGE",
  deliverySk: (broadcastId: string, subscriptionId: string, channel: string) =>
    `CASUB_DELIVERY#${broadcastId}#${subscriptionId}#${channel}`,
  previewSk: (previewId: string) => `CASUB_PREVIEW#${previewId}`,
  campaignSk: (campaignId: string) => `CASUB_CAMPAIGN#${campaignId}`,
} as const;
