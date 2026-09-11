import type { VisionCamera } from "rapid-cortex-shared";

/**
 * HLS transcript worker needs a KVS *video stream* name or ARN (GetHLSStreamingSessionURL),
 * not only the WebRTC signaling channel.
 *
 * Ring sessions typically have no separate media ARN — use the signaling channel name as
 * StreamName so archived-media HLS can resolve when media storage is enabled on that stream.
 */
export function resolveVisionSessionKvsRef(
  camera: Pick<VisionCamera, "kvsChannelName" | "kvsStreamArn">,
): {
  kvsChannelName: string | null;
  kvsStreamArn: string | null;
} {
  const kvsChannelName = camera.kvsChannelName?.trim() || null;
  const storedArn = camera.kvsStreamArn?.trim() || null;
  return {
    kvsChannelName,
    kvsStreamArn: storedArn ?? kvsChannelName,
  };
}

/** Signaling channel name for WebRTC viewer tokens — never a media-stream ARN. */
export function visionWebRtcChannelName(session: {
  kvsChannelName?: string | null;
  kvsStreamArn?: string | null;
}): string {
  const channel = (session.kvsChannelName ?? "").trim();
  if (channel && !channel.startsWith("arn:")) return channel;

  const arn = (session.kvsStreamArn ?? "").trim();
  if (arn.startsWith("arn:") && arn.includes(":channel/")) {
    return arn.split(":channel/")[1]?.split("/")[0] ?? "";
  }
  if (arn && !arn.startsWith("arn:")) return arn;
  return "";
}
