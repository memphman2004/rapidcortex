import {
  DescribeSignalingChannelCommand,
  KinesisVideoClient,
} from "@aws-sdk/client-kinesis-video";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";

const kvs = new KinesisVideoClient({ region: process.env.AWS_REGION });
const channels = new KvsChannelService();

/** Provision a KVS signaling channel for an approved Ring emergency session. */
export async function provisionRingEmergencyKvsChannel(sessionId: string): Promise<{
  channelName: string;
  channelArn: string;
}> {
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
