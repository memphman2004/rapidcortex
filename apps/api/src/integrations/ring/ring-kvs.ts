/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

import {
  DescribeSignalingChannelCommand,
  KinesisVideoClient,
} from "@aws-sdk/client-kinesis-video";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";
import { RING_INTEGRATION_ENABLED } from "./ring-api-response.js";

const kvs = new KinesisVideoClient({ region: process.env.AWS_REGION });
const channels = new KvsChannelService();

/** Provision a KVS signaling channel for an approved Ring emergency session. */
export async function provisionRingEmergencyKvsChannel(sessionId: string): Promise<{
  channelName: string;
  channelArn: string;
}> {
  // RING_DISABLED — do not provision Ring emergency KVS channels while suspended
  if (!RING_INTEGRATION_ENABLED) {
    throw new Error("RING_INTEGRATION_DISABLED");
  }
  const channelName = await channels.createSessionChannel(sessionId, "rc-connect");
  const described = await kvs.send(
    new DescribeSignalingChannelCommand({ ChannelName: channelName }),
  );
  const channelArn = described.ChannelInfo?.ChannelARN;
  if (!channelArn) {
    throw new Error(`KVS channel ARN missing after create: ${channelName}`);
  }
  return { channelName, channelArn };
}
