import type { KvsBrowserBundle } from "rapid-cortex-shared";
import { Role, SignalingClient } from "amazon-kinesis-video-streams-webrtc";

/**
 * Master (caller): publishes camera/mic; answers the viewer’s SDP offer.
 * Returns a stop function to release signaling, peer connection, and media.
 */
export function startKvsMaster(kvs: KvsBrowserBundle, videoEl: HTMLVideoElement, onError: (message: string) => void): () => void {
  if (kvs.role !== "MASTER") {
    onError("Invalid KVS role for master");
    return () => {};
  }
  const iceServers = kvs.iceServers.map((s) => ({
    urls: s.urls,
    username: s.username,
    credential: s.credential,
  }));
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
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not open camera");
      }
    })();
  });

  signaling.on("sdpOffer", (offer, senderClientId) => {
    if (!senderClientId) return;
    viewerId = senderClientId;
    void (async () => {
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          signaling.sendSdpAnswer(pc.localDescription, senderClientId);
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "WebRTC answer failed");
      }
    })();
  });

  signaling.on("iceCandidate", (candidate, senderClientId) => {
    if (!senderClientId) return;
    viewerId = viewerId || senderClientId;
    void pc.addIceCandidate(candidate).catch(() => {});
  });

  pc.addEventListener("icecandidate", (ev) => {
    if (ev.candidate && viewerId) {
      signaling.sendIceCandidate(ev.candidate, viewerId);
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
 * Viewer (dispatcher): one-way receive from master.
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
  const iceServers = kvs.iceServers.map((s) => ({
    urls: s.urls,
    username: s.username,
    credential: s.credential,
  }));
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
