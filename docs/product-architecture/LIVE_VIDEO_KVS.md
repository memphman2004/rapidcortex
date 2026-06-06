# Live video: Kinesis Video Streams WebRTC

Implementation notes for operators and future development.

## How AWS models this (matches the KVS console)

AWS documents **Kinesis Video Streams with WebRTC** as the managed capability for live two-way audio/video. That path uses **signaling channels** for WebRTC signaling.

For **optional cloud ingestion/recording**, AWS documents a flow where you also use a **Kinesis video stream** (media storage) alongside the signaling channel, with APIs such as `UpdateMediaStorageConfiguration` / storage session patterns as applicable.

**In Rapid Cortex (runtime, not manual console):**

| Product mode | What the API creates per session |
| --- | --- |
| **Live-only WebRTC** | **Signaling channel** only (`CreateSignalingChannel` in `kvsWebRtcService`). Caller = master, dispatcher = viewer. |
| **Live + optional storage** | **Signaling channel** plus, when `LIVE_VIDEO_STORAGE_MODE` / per-request `storageMode` is **`kvs-ingestion`**, a **video stream** (`CreateStream` in `kvsStorageService`). Channel→stream attach is **off by default** (`LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL=false`) so standard master/viewer live mode is preserved; turn attach on only when you are ready for AWS’s storage-session client model. |

**Console vs app:** In production, Rapid Cortex **creates and deletes** resources **via the API** when a dispatcher requests live video—you do **not** need to click **Create signaling channel** or **Create video stream** in the console for each incident. Manual resources in the console are **not** wired into sessions unless you change the product to use a fixed pool of names.

**If you still want to use the console (e.g. smoke-test IAM or the KVS UI):**

1. **Signaling channel** — In **Kinesis Video Streams** → **Signaling channels** → **Create signaling channel**. Any legal test name is fine (e.g. `rc-manual-test-1`). Type **SINGLE_MASTER** matches the app. This channel is **only** for your own console/SDK experiments; live sessions from Rapid Cortex will create names like **`rc-live-{sessionId}`** (see `kvsWebRtcService.ts`).
2. **Video stream** — **Video streams** → **Create video stream**. Pick a test name (e.g. `rc-manual-storage-1`) and a retention period. App-created storage streams use **`rc-lvsv-{sessionId}`** (see `kvsStorageService.ts`) when `LIVE_VIDEO_STORAGE_MODE` is `kvs-ingestion`.

After a real **Request live video** from the app, refresh **Signaling channels** and **Video streams** in the **same region** as `AWS_REGION`; you should see new `rc-live-*` and (with storage on) `rc-lvsv-*` rows created automatically.

**CLI bootstrap (optional fixtures):** From the repo root, with credentials and `AWS_REGION` set to your stack region:

```bash
export AWS_REGION=us-east-2   # example — match your deploy region
./scripts/aws-kvs-live-video-bootstrap.sh
```

That creates **`rc-bootstrap-signaling`** (SINGLE_MASTER, 60s message TTL) and **`rc-bootstrap-storage`** (default 7-day retention). Override names with `KVS_BOOTSTRAP_SIGNALING_CHANNEL_NAME` / `KVS_BOOTSTRAP_STORAGE_STREAM_NAME` if needed. The script is idempotent (skips if resources already exist).

## Region alignment (important)

**Keep KVS in the same AWS Region as your Rapid Cortex backend** (same `AWS_REGION` on Lambdas / API as where you expect channels and streams to exist).

If your console is open in **us-east-2 (Ohio)** but the stack runs in **us-east-1**, you will see an empty dashboard in one region while the app creates resources in another. That split is only intentional if you **designed** multi-region; otherwise align deploy region, `AWS_REGION`, and where you review KVS in the console.

## AWS prerequisites

- **Region**: Use the same `AWS_REGION` as the rest of the stack (KVS signaling, optional video stream, and archived-media HLS are all regional).
- **KVS WebRTC browser role**: `LIVE_VIDEO_KVS_TOKEN_ROLE_ARN` must point at an IAM role the API can `sts:AssumeRole` into, scoped for `kinesisvideo:ConnectAsMaster` / `ConnectAsViewer` on the channels used by the app.
- **SMS**: `SMS_PROVIDER` and Twilio or AWS SNS; secrets via Secrets Manager (e.g. `INCIDENT_MEDIA_TWILIO_SECRET_ARN`). SMS is **link delivery only**. Outbound identity (e.g. toll-free **`+18556293679`** on Twilio) is **send-only**; `callerPhone` on **`POST .../live-video/request`** must always be the **caller's mobile** (E.164), not the toll-free.

## Signaling channel behavior

- Each live session creates a **Signaling channel** via `CreateSignalingChannel` (see `kvsWebRtcService`).
- **Product default (live-only)**: Caller connects as KVS **master**; dispatcher as **viewer** (see `kvsChannelRoleMode` / pipeline `aws_kinesis_webrtc`).

## Storage mode (`LIVE_VIDEO_STORAGE_MODE`)

- **Default (unset)**: **`kvs-ingestion`** — **live + storage** setup: each session gets a signaling channel **and** a Kinesis **video** stream (`CreateStream`). Set `LIVE_VIDEO_STORAGE_MODE=off` for live-only and no stream.
- **`off`**: No Kinesis **video** stream for the session. Standard master/viewer live path only.
- **`kvs` or `kvs-ingestion`**: Same as default — stream is created for ingest/record.  
- **`LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL`**: When `true`, the API calls `UpdateMediaStorageConfiguration` to map the stream to the signaling channel. **AWS then expects storage-session style clients** (`JoinStorageSession` / related), not the default master/viewer used today. **Default is `false`** so live master/viewer keeps working; the stream can still be created and used for metadata/playback experiments when media is present.

## Where completed / recorded video lives (no dedicated S3 bucket today)

- **Kinesis Video Streams** (the **video stream** created in `kvs-ingestion` mode) holds retained media for the stream’s **data retention** window. Rapid Cortex does **not** copy that recording into **S3** when a session ends.
- **S3** is used elsewhere for **caller incident media uploads** (`ASSETS_BUCKET`, prefix `incident-media/...`) — that is a different feature (SMS upload link), not automatic export of live WebRTC.
- **Playback** in the dispatcher UI uses **short-lived HLS** URLs from the archived-media API, not a stable `s3://` object.
- **Future option:** an explicit **KVS → S3** export pipeline (e.g. fragment / session archival + Lambda + optional MediaConvert) is not implemented; add it if you need long-term files in a bucket.

## Playback

- **HLS** URLs come from `GetDataEndpoint` + `GetHLSStreamingSessionURL` (archived media). URLs are **short-lived**; the dispatcher UI may open a new tab or refresh metadata from `GET /api/incidents/{id}/live-video/playback`.
- Safari often plays HLS in `<video>`; Chrome may need a player library or use “open in new tab” (native support varies).

## Environment / feature flags

- **`ENABLE_LIVE_VIDEO`**: API must be `"true"` for live video routes.
- **`NEXT_PUBLIC_ENABLE_LIVE_VIDEO`**: Web UI feature gate (if used in the app).
- **TTL / limits**: `LIVE_VIDEO_SESSION_TTL_SECONDS`, `LIVE_VIDEO_MAX_DURATION_SECONDS`, `LIVE_VIDEO_HEARTBEAT_TIMEOUT_SECONDS`.
- **Tagging (`KVS_WEBRTC_TAG_APP`, `KVS_WEBRTC_TAG_ENV`)**: Applied to created video streams for cost/ownership.

## Browser / device

- **Caller**: Mobile browser; camera/mic permission required; **no login** (token in URL).
- **Dispatcher**: Authenticated workspace; KVS **viewer** path.

## Auditing

Key audit types include `live_video.requested`, `live_video.sms.sent`, `live_video.activated`, `live_video.storage_configured`, `live_video.ended`, `live_video.playback_accessed` (see `rapid-cortex-security` audit schema).

## Future extension points (not in current scope)

- Blur / privacy filter on sender or receiver.
- Snapshots to incident media.
- Unified incident media gallery.
- Responder or third-party sharing.
- F6 or cross-jurisdiction compatibility layers.
