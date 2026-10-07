import {
  CreateSignalingChannelCommand,
  DeleteSignalingChannelCommand,
  DescribeSignalingChannelCommand,
  GetSignalingChannelEndpointCommand,
  KinesisVideoClient,
} from "@aws-sdk/client-kinesis-video";
import {
  GetIceServerConfigCommand,
  KinesisVideoSignalingClient,
} from "@aws-sdk/client-kinesis-video-signaling";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

const kvs = new KinesisVideoClient({ region: process.env.AWS_REGION });
const sts = new STSClient({ region: process.env.AWS_REGION });

export type ChannelPrefix = "rc-connect" | "rc-venue";

export interface KvsViewerToken {
  channelName: string;
  channelArn: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
  };
  wssEndpoint: string;
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export class KvsChannelService {
  async createSessionChannel(sessionId: string, prefix: ChannelPrefix): Promise<string> {
    const channelName = `${prefix}-${sessionId}`;
    await kvs.send(
      new CreateSignalingChannelCommand({
        ChannelName: channelName,
        ChannelType: "SINGLE_MASTER",
        SingleMasterConfiguration: { MessageTtlSeconds: 60 },
        Tags: [
          { Key: "sessionId", Value: sessionId },
          { Key: "product", Value: prefix.replace("rc-", "") },
          { Key: "managedBy", Value: "rapid-cortex" },
        ],
      }),
    );
    return channelName;
  }

  async issueViewerToken(channelName: string): Promise<KvsViewerToken> {
    const described = await kvs.send(
      new DescribeSignalingChannelCommand({ ChannelName: channelName }),
    );
    const channelArn = described.ChannelInfo?.ChannelARN;
    if (!channelArn) throw new Error(`Channel not found: ${channelName}`);

    const endpoints = await kvs.send(
      new GetSignalingChannelEndpointCommand({
        ChannelARN: channelArn,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ["WSS", "HTTPS"],
          Role: "VIEWER",
        },
      }),
    );

    const wssEndpoint =
      endpoints.ResourceEndpointList?.find((e) => e.Protocol === "WSS")?.ResourceEndpoint ?? "";
    const httpsEndpoint =
      endpoints.ResourceEndpointList?.find((e) => e.Protocol === "HTTPS")?.ResourceEndpoint ?? "";
    if (!wssEndpoint || !httpsEndpoint) {
      throw new Error(`KVS signaling endpoints missing for ${channelName}`);
    }

    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: required("KVS_BROWSER_TOKEN_ROLE_ARN"),
        RoleSessionName: `viewer-${channelName.slice(-20)}`,
        DurationSeconds: 900,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "kinesisvideo:GetSignalingChannelEndpoint",
                "kinesisvideo:ConnectAsViewer",
                "kinesisvideo:DescribeSignalingChannel",
              ],
              Resource: channelArn,
            },
          ],
        }),
      }),
    );

    const creds = assumed.Credentials;
    if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken || !creds.Expiration) {
      throw new Error("Could not assume KVS browser role");
    }

    const signalingClient = new KinesisVideoSignalingClient({
      region: required("AWS_REGION"),
      endpoint: httpsEndpoint,
      credentials: {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
      },
    });

    const iceConfig = await signalingClient.send(
      new GetIceServerConfigCommand({ ChannelARN: channelArn }),
    );

    const iceServers = [
      { urls: [`stun:stun.kinesisvideo.${required("AWS_REGION")}.amazonaws.com:443`] },
      ...((iceConfig.IceServerList ?? []).map((s) => ({
        urls: s.Uris ?? [],
        username: s.Username,
        credential: s.Password,
      })) as Array<{ urls: string[]; username?: string; credential?: string }>),
    ];

    return {
      channelName,
      channelArn,
      region: required("AWS_REGION"),
      credentials: {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
        expiration: creds.Expiration.toISOString(),
      },
      wssEndpoint,
      iceServers,
    };
  }

  async deleteSessionChannel(channelName: string): Promise<void> {
    try {
      const described = await kvs.send(
        new DescribeSignalingChannelCommand({ ChannelName: channelName }),
      );
      const channelArn = described.ChannelInfo?.ChannelARN;
      if (!channelArn) return;
      await kvs.send(
        new DeleteSignalingChannelCommand({
          ChannelARN: channelArn,
          CurrentVersion: described.ChannelInfo?.Version,
        }),
      );
    } catch (err) {
      console.warn(`[kvs] deleteSessionChannel ${channelName}:`, err);
    }
  }
}
