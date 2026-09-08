import type { KvsBrowserBundle } from "rapid-cortex-shared";
import { Role, SignalingClient } from "amazon-kinesis-video-streams-webrtc";
import { joinStorageSessionUntilOffer } from "./kvs-join-storage";

function iceServersFromBundle(kvs: KvsBrowserBundle): RTCIceServer[] {
  return kvs.iceServers.map((s) => ({
    urls: s.urls,
    username: s.username,
    credential: s.credential,
  }));
}

async function joinAsProducer(kvs: KvsBrowserBundle, isOfferReceived: () => boolean, isStopped: () => boolean): Promise<boolean> {
  const { JoinStorageSessionCommand, KinesisVideoWebRTCStorageClient } = await import(
    "@aws-sdk/client-kinesis-video-webrtc-storage"
  );
  if (!kvs.webrtcStorageEndpoint) throw new Error("Missing WEBRTC storage endpoint");
  const client = new KinesisVideoWebRTCStorageClient({
    region: kvs.region,
    endpoint: kvs.webrtcStorageEndpoint,
    credentials: {
      accessKeyId: kvs.credentials.accessKeyId,
      secretAccessKey: kvs.credentials.secretAccessKey,
      sessionToken: kvs.credentials.sessionToken,
    },
  });
  return joinStorageSessionUntilOffer({
    isOfferReceived,
    isStopped,
    sendJoin: () => client.send(new JoinStorageSessionCommand({ channelArn: kvs.channelArn })).then(() => undefined),
  });
}

async function joinAsViewer(kvs: KvsBrowserBundle, isOfferReceived: () => boolean, isStopped: () => boolean): Promise<boolean> {
  const { JoinStorageSessionAsViewerCommand, KinesisVideoWebRTCStorageClient } = await import(
    "@aws-sdk/client-kinesis-video-webrtc-storage"
  );
  const clientId = kvs.viewerClientId;
  if (!clientId) throw new Error("Viewer client id required for storage session");
  if (!kvs.webrtcStorageEndpoint) throw new Error("Missing WEBRTC storage endpoint");
  const client = new KinesisVideoWebRTCStorageClient({
    region: kvs.region,
    endpoint: kvs.webrtcStorageEndpoint,
    credentials: {
      accessKeyId: kvs.credentials.accessKeyId,
      secretAccessKey: kvs.credentials.secretAccessKey,
      sessionToken: kvs.credentials.sessionToken,
    },
  });
  return joinStorageSessionUntilOffer({
    isOfferReceived,
    isStopped,
    sendJoin: () =>
      client
        .send(new JoinStorageSessionAsViewerCommand({ channelArn: kvs.channelArn, clientId }))
        .then(() => undefined),
  });
}

/**
 * Master (caller): publishes camera/mic; answers the viewer’s (or storage peer’s) SDP offer.
 * Returns a stop function to release signaling, peer connection, and media.
 */
export function startKvsMaster(kvs: KvsBrowserBundle, videoEl: HTMLVideoElement, onError: (message: string) => void): () => void {
  if (kvs.role !== "MASTER") {
    onError("Invalid KVS role for master");
    return () => {};
  }
  if (kvs.mediaStorageEnabled && !kvs.webrtcStorageEndpoint) {
    onError("Cloud ingest is enabled but the storage endpoint is missing");
    return () => {};
  }
  const iceServers = iceServersFromBundle(kvs);
  const pc = new RTCPeerConnection({ iceServers });
  const signaling = new SignalingClient({
    channelARN: kvs.channelArn,
    channelEndpoint: kvs.wssUrl,
    role: Role.MASTER,
    region: kvs.region,
    credentials: {
      accessKeyId: kvs.credentials.accessKeyId,
      secretAccessKey: kvs.credentials.secretAccessKey,
      sessionToken: kvs.credentials.sessionToken,
    },
  });
  let viewerId: string | null = null;
  let localStream: MediaStream | null = null;
  let done = false;
  let sdpOfferReceived = false;

  const stop = () => {
    if (done) return;
    done = true;
    try {
      signaling.close();
    } catch {
      /* noop */
    }
    try {
      pc.close();
    } catch {
      /* noop */
    }
    localStream?.getTracks().forEach((t) => t.stop());
    localStream = null;
    if (videoEl.srcObject) videoEl.srcObject = null;
  };

  signaling.on("open", () => {
    void (async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: true,
        });
        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));
        videoEl.srcObject = localStream;
        if (kvs.mediaStorageEnabled) {
          const joined = await joinAsProducer(
            kvs,
            () => sdpOfferReceived,
            () => done,
          );
          if (!joined && !done) onError("Could not join cloud recording session");
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not open camera");
      }
    })();
  });

  signaling.on("sdpOffer", (offer, senderClientId) => {
    const remoteId = senderClientId || "storage";
    viewerId = remoteId;
    sdpOfferReceived = true;
    void (async () => {
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          signaling.sendSdpAnswer(pc.localDescription, senderClientId || undefined);
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "WebRTC answer failed");
      }
    })();
  });

  signaling.on("iceCandidate", (candidate, senderClientId) => {
    viewerId = viewerId || senderClientId || "storage";
    void pc.addIceCandidate(candidate).catch(() => {});
  });

  pc.addEventListener("icecandidate", (ev) => {
    if (ev.candidate && viewerId) {
      signaling.sendIceCandidate(ev.candidate, viewerId === "storage" ? undefined : viewerId);
    }
  });

  signaling.on("error", (e) => {
    onError(e instanceof Error ? e.message : "KVS signaling error");
  });

  try {
    signaling.open();
  } catch (e) {
    onError(e instanceof Error ? e.message : "KVS could not start");
  }

  return stop;
}

/**
 * Viewer (dispatcher): one-way receive from master, or from the cloud recording agent when ingest is on.
 */
export function startKvsViewer(
  kvs: KvsBrowserBundle,
  videoEl: HTMLVideoElement,
  onError: (message: string) => void,
): () => void {
  if (kvs.role !== "VIEWER" || !kvs.viewerClientId) {
    onError("Invalid KVS viewer configuration");
    return () => {};
  }
  if (kvs.mediaStorageEnabled && !kvs.webrtcStorageEndpoint) {
    onError("Cloud ingest is enabled but the storage endpoint is missing");
    return () => {};
  }
  const iceServers = iceServersFromBundle(kvs);
  const pc = new RTCPeerConnection({ iceServers });
  const signaling = new SignalingClient({
    channelARN: kvs.channelArn,
    channelEndpoint: kvs.wssUrl,
    role: Role.VIEWER,
    clientId: kvs.viewerClientId,
    region: kvs.region,
    credentials: {
      accessKeyId: kvs.credentials.accessKeyId,
      secretAccessKey: kvs.credentials.secretAccessKey,
      sessionToken: kvs.credentials.sessionToken,
    },
  });
  let done = false;
  let sdpOfferReceived = false;
  const stop = () => {
    if (done) return;
    done = true;
    try {
      signaling.close();
    } catch {
      /* noop */
    }
    try {
      pc.close();
    } catch {
      /* noop */
    }
    if (videoEl.srcObject) videoEl.srcObject = null;
  };

  signaling.on("open", () => {
    void (async () => {
      try {
        if (kvs.mediaStorageEnabled) {
          const joined = await joinAsViewer(
            kvs,
            () => sdpOfferReceived,
            () => done,
          );
          if (!joined && !done) onError("Could not join cloud recording session as viewer");
          return;
        }
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          signaling.sendSdpOffer(pc.localDescription);
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "WebRTC offer failed");
      }
    })();
  });

  signaling.on("sdpOffer", (offer) => {
    sdpOfferReceived = true;
    void (async () => {
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          signaling.sendSdpAnswer(pc.localDescription);
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not answer storage session");
      }
    })();
  });

  signaling.on("sdpAnswer", (answer) => {
    void (async () => {
      try {
        await pc.setRemoteDescription(answer);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not apply remote answer");
      }
    })();
  });

  signaling.on("iceCandidate", (candidate) => {
    void pc.addIceCandidate(candidate).catch(() => {});
  });

  pc.addEventListener("icecandidate", (ev) => {
    if (ev.candidate) {
      signaling.sendIceCandidate(ev.candidate);
    }
  });

  pc.addEventListener("track", (ev) => {
    if (!videoEl.srcObject && ev.streams[0]) {
      videoEl.srcObject = ev.streams[0];
    }
  });

  signaling.on("error", (e) => {
    onError(e instanceof Error ? e.message : "KVS signaling error");
  });

  try {
    signaling.open();
  } catch (e) {
    onError(e instanceof Error ? e.message : "KVS could not start");
  }

  return stop;
}
