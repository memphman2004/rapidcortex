/**
 * EventBridge wrapper for S3 Object Created → vault CSV ingest.
 * Avoids CloudFormation circular dependency between Bucket notifications and Lambda.
 */

import type { EventBridgeHandler } from "aws-lambda";
import { handler as s3Handler } from "./vault-ingest.js";

type S3ObjectCreatedDetail = {
  bucket?: { name?: string };
  object?: { key?: string; size?: number };
};

export const handler: EventBridgeHandler<"Object Created", S3ObjectCreatedDetail, void> = async (
  event,
) => {
  const bucket = event.detail?.bucket?.name;
  const key = event.detail?.object?.key;
  if (!bucket || !key) {
    console.warn("vault-ingest-eventbridge missing bucket/key", event.id);
    return;
  }
  if (!key.toLowerCase().endsWith(".csv")) {
    console.info("vault-ingest-eventbridge skip non-csv", key);
    return;
  }

  await s3Handler(
    {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: event.region ?? process.env.AWS_REGION ?? "us-east-1",
          eventTime: event.time,
          eventName: "ObjectCreated:Put",
          userIdentity: { principalId: "EventBridge" },
          requestParameters: { sourceIPAddress: "0.0.0.0" },
          responseElements: {
            "x-amz-request-id": event.id,
            "x-amz-id-2": event.id,
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "vault-eventbridge",
            bucket: {
              name: bucket,
              ownerIdentity: { principalId: "EventBridge" },
              arn: `arn:aws:s3:::${bucket}`,
            },
            object: {
              key,
              size: event.detail?.object?.size ?? 0,
              eTag: "",
              sequencer: "0",
            },
          },
        },
      ],
    },
    {} as never,
    () => undefined,
  );
};
