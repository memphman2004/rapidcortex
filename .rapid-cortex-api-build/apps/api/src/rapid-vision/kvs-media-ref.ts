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

/**
 * True when `ref` can be passed to GetHLSStreamingSessionURL as a *video stream*
 * (ARN with `:stream/`, or a non-ARN stream name). Signaling channel ARNs (`:channel/`)
 * and empty strings are not HLS-capable.
 */
export function isKvsHlsMediaStreamRef(ref: string | null | undefined): boolean {
  const value = (ref ?? "").trim();
  if (!value) return false;
  if (value.startsWith("arn:")) {
    return value.includes(":stream/") && !value.includes(":channel/");
  }
  // Non-ARN names are allowed only when they are not clearly a channel ARN fragment.
  return !value.includes(":channel/");
}

/**
 * Resolve the stream ARN/name for live closed-captioning (ffmpeg → Transcribe).
 * Prefers an explicit media stream ARN. Does not treat a WebRTC signaling channel
 * as an HLS source — that path fails silently in the worker.
 */
export function resolveTranscriptHlsStreamRef(session: {
  kvsChannelName?: string | null;
  kvsStreamArn?: string | null;
}): string | null {
  const streamArn = (session.kvsStreamArn ?? "").trim();
  if (isKvsHlsMediaStreamRef(streamArn)) {
    // Reject the common Ring fallback where kvsStreamArn was copied from the channel name.
    const channel = (session.kvsChannelName ?? "").trim();
    if (channel && streamArn === channel && !streamArn.startsWith("arn:")) {
      return null;
    }
    return streamArn;
  }
  return null;
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
