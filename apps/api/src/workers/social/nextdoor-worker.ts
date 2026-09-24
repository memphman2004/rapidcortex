/**
 * nextdoor-worker.ts
 * Stub webhook receiver for Nextdoor Neighbors App (public agencies).
 *
 * TODO: Pending Nextdoor agency enrollment.
 * Apply at: https://help.nextdoor.com/s/article/About-Nextdoor-for-Public-Agencies
 *
 * Once enrolled, mirror Ring Neighbors:
 * - Validate webhook signature from Secrets Manager
 * - Map payload geo → agency via SOCIAL_AGENCY_CONFIGS
 * - Call ingestSocialSignal({ source: "nextdoor", … })
 *
 * SAM route is deployed now so the endpoint can be registered when enrollment completes.
 * Twitter/X is intentionally excluded.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const nextdoorWebhookHandler: APIGatewayProxyHandlerV2 = async (event) => {
  console.info(
    "[nextdoor] TODO: Pending Nextdoor agency enrollment — stub accepting webhook",
    {
      path: event.rawPath,
      method: event.requestContext.http.method,
      hasBody: Boolean(event.body),
    },
  );

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      received: true,
      ingested: false,
      status: "pending_enrollment",
      message:
        "Nextdoor webhook stub. Complete Neighbors App enrollment, then wire signature validation + ingestSocialSignal.",
    }),
  };
};

/** Alias for SAM Handler naming flexibility. */
export const handler = nextdoorWebhookHandler;
