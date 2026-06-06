import {
  CreateSignalingChannelCommand,
  DeleteSignalingChannelCommand,
  GetSignalingChannelEndpointCommand,
  KinesisVideoClient,
} from "@aws-sdk/client-kinesis-video";
import { GetIceServerConfigCommand, KinesisVideoSignalingClient } from "@aws-sdk/client-kinesis-video-signaling";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { env } from "../lib/env.js";

export type KvsRole = "MASTER" | "VIEWER";

export type KvsBrowserBundle = {
  channelArn: string;
  region: string;
  role: KvsRole;
  /** Required for VIEWER SignalingClient (stable per session). */
  viewerClientId?: string;
  wssUrl: string;
  iceServers: { urls: string | string[]; username?: string; credential?: string }[];
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
  };
};

const kvClient = new KinesisVideoClient({ region: env.region });
const stsClient = new STSClient({ region: env.region });

function assertKvsEnabled(): void {
  if (!env.liveVideoKvsTokenRoleArn) {
    const err = new Error("KVS_NOT_CONFIGURED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function sessionPolicyForChannel(channelArn: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "kinesisvideo:ConnectAsMaster",
          "kinesisvideo:ConnectAsViewer",
          "kinesisvideo:JoinStorageSession",
          "kinesisvideo:JoinStorageSessionAsViewer",
          "kinesisvideo:DescribeSignalingChannel",
          "kinesisvideo:GetSignalingChannelEndpoint",
          "kinesisvideo:GetIceServerConfig",
        ],
        Resource: channelArn,
      },
    ],
  });
}

function normalizeChannelName(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_.-]/g, "-");
  const name = `rc-live-${safe}`;
  return name.length <= 256 ? name : name.slice(0, 256);
}

/**
 * Create a Kinesis Video Streams signaling channel for single-master WebRTC.
 */
export async function createKinesisSignalingChannel(sessionId: string): Promise<{
  channelArn: string;
  channelName: string;
}> {
  assertKvsEnabled();
  const channelName = normalizeChannelName(sessionId);
  const out = await kvClient.send(
    new CreateSignalingChannelCommand({
      ChannelName: channelName,
      ChannelType: "SINGLE_MASTER",
      SingleMasterConfiguration: { MessageTtlSeconds: 60 },
    }),
  );
  if (!out.ChannelARN) {
    throw new Error("KVS_CREATE_NO_ARN");
  }
  return { channelArn: out.ChannelARN, channelName };
}

export async function deleteKinesisSignalingChannel(channelArn: string | undefined | null): Promise<void> {
  if (!channelArn) return;
  try {
    await kvClient.send(new DeleteSignalingChannelCommand({ ChannelARN: channelArn }));
  } catch {
    // best-effort cleanup; channel may already be removed
  }
}

async function getEndpointsAndIce(
  channelArn: string,
  kvsRole: "MASTER" | "VIEWER",
): Promise<{
  wssUrl: string;
  httpsUrl: string;
  iceServers: { urls: string | string[]; username?: string; credential?: string }[];
}> {
  const ep = await kvClient.send(
    new GetSignalingChannelEndpointCommand({
      ChannelARN: channelArn,
      SingleMasterChannelEndpointConfiguration: {
        Protocols: ["WSS", "HTTPS"],
        Role: kvsRole,
      },
    }),
  );
  const byProto = (ep.ResourceEndpointList ?? []).reduce<Record<string, string>>((acc, cur) => {
    if (cur.Protocol && cur.ResourceEndpoint) acc[cur.Protocol] = cur.ResourceEndpoint;
    return acc;
  }, {});
  const wssUrl = byProto.WSS;
  const httpsUrl = byProto.HTTPS;
  if (!wssUrl || !httpsUrl) {
    throw new Error("KVS_MISSING_SIGNALING_ENDPOINTS");
  }
  const signaling = new KinesisVideoSignalingClient({ region: env.region, endpoint: httpsUrl });
  const iceOut = await signaling.send(
    new GetIceServerConfigCommand({
      ChannelARN: channelArn,
    }),
  );
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: `stun:stun.kinesisvideo.${env.region}.amazonaws.com:443` },
  ];
  for (const s of iceOut.IceServerList ?? []) {
    iceServers.push({
      urls: s.Uris ?? [],
      username: s.Username,
      credential: s.Password,
    });
  }
  return { wssUrl, httpsUrl, iceServers };
}

/**
 * Assumed-role credentials (scoped in-session policy to this channel) for browser KVS WebRTC.
 */
export async function buildKvsBrowserBundle(args: {
  channelArn: string;
  sessionId: string;
  role: KvsRole;
  viewerClientId?: string;
}): Promise<KvsBrowserBundle> {
  assertKvsEnabled();
  if (args.role === "VIEWER" && !args.viewerClientId) {
    throw new Error("KVS_VIEWER_CLIENT_ID_REQUIRED");
  }
  const { wssUrl, iceServers } = await getEndpointsAndIce(
    args.channelArn,
    args.role === "MASTER" ? "MASTER" : "VIEWER",
  );
  const roleSession = `kvs-${args.sessionId}`.replace(/[^a-zA-Z0-9=,.@-]/g, "-").slice(0, 64);
  const assumed = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: env.liveVideoKvsTokenRoleArn,
      RoleSessionName: roleSession,
      DurationSeconds: 3600,
      Policy: sessionPolicyForChannel(args.channelArn),
    }),
  );
  const c = assumed.Credentials;
  if (!c?.AccessKeyId || !c?.SecretAccessKey || !c?.SessionToken || !c?.Expiration) {
    throw new Error("KVS_ASSUME_ROLE_FAILED");
  }
  return {
    channelArn: args.channelArn,
    region: env.region,
    role: args.role,
    viewerClientId: args.viewerClientId,
    wssUrl,
    iceServers,
    credentials: {
      accessKeyId: c.AccessKeyId,
      secretAccessKey: c.SecretAccessKey,
      sessionToken: c.SessionToken,
      expiration: c.Expiration.toISOString(),
    },
  };
}

export function isKvsPipelineConfigured(): boolean {
  return Boolean(env.liveVideoKvsTokenRoleArn);
}
