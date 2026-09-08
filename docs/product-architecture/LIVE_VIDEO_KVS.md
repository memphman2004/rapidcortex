# Live video: Kinesis Video Streams WebRTC

Implementation notes for operators and future development.

## How AWS models this (matches the KVS console)

AWS documents **Kinesis Video Streams with WebRTC** as the managed capability for live two-way audio/video. That path uses **signaling channels** for WebRTC signaling.

For **optional cloud ingestion/recording**, AWS documents a flow where you also use a **Kinesis video stream** (media storage) alongside the signaling channel, with APIs such as `UpdateMediaStorageConfiguration` / storage session patterns as applicable.

**In Rapid Cortex (runtime, not manual console):**

| Product mode | What the API creates per session |
| --- | --- |
| **Live-only WebRTC** | **Signaling channel** only. Set `LIVE_VIDEO_STORAGE_MODE=off`. Caller = master, dispatcher = viewer (plain peer connection). |
| **Live + cloud ingest (production default)** | Signaling channel **and** a Kinesis **video** stream (`CreateStream`). `LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL` defaults **on**: `UpdateMediaStorageConfiguration` maps the channel to the stream. Browsers **must** call `JoinStorageSession` (caller) / `JoinStorageSessionAsViewer` (dispatcher). |

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
- **SMS**: `SMS_PROVIDER` and Twilio or AWS SNS; secrets via Secrets Manager (e.g. `INCIDENT_MEDIA_TWILIO_SECRET_ARN`). SMS is **link delivery only**. Outbound identity (**`+14707482763`** on Twilio) is **send-only**; `callerPhone` on **`POST .../live-video/request`** must always be the **caller's mobile** (E.164), not the sending number.

## Signaling channel behavior

- Each live session creates a **Signaling channel** via `CreateSignalingChannel` (see `kvsWebRtcService`).
- **Product default**: Caller connects as KVS **master**; dispatcher as **viewer**. With ingest attached, both sides join the **storage session** (AWS storage peer sends the SDP offer). The signaling channel is **deleted on hang-up**; the **video stream is kept** until GetClip export succeeds (or KVS data retention expires).

## Storage mode (`LIVE_VIDEO_STORAGE_MODE`)

- **Default (unset)**: **`kvs-ingestion`** — live + storage: signaling channel **and** a Kinesis **video** stream (`CreateStream`). Set `LIVE_VIDEO_STORAGE_MODE=off` for live-only (no stream, no ingest).
- **`off`**: No Kinesis **video** stream. Standard master/viewer live path only.
- **`kvs` or `kvs-ingestion`**: Stream is created for ingest/record.
- **`LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL`**: Default **on** when unset. The API calls `UpdateMediaStorageConfiguration` so WebRTC media is ingested to the stream. Clients use `JoinStorageSession` / `JoinStorageSessionAsViewer` and the **WEBRTC** signaling endpoint. Set to `false` only for live P2P with an unused reserved stream (not production ingest).
- **Browser STS** already includes `kinesisvideo:JoinStorageSession` and `JoinStorageSessionAsViewer` on the per-session channel.

## Where completed / recorded video lives

Kinesis Video Streams is **not** S3. Two retention layers:

1. **KVS data retention** (`LIVE_VIDEO_KVS_DATA_RETENTION_HOURS`, default 24) — fragments stay on the per-session stream (`rc-lvsv-*`). The stream is **not** deleted on hang-up.
2. **S3 export** (`LIVE_VIDEO_EXPORT_TO_S3`, default on) — after the session ends, a worker (and playback GET as fallback) calls **GetClip** and writes `live-video/{agencyId}/{incidentId}/{sessionId}.mp4` to `ASSETS_BUCKET`. After a successful export the KVS stream is deleted. Dispatcher playback prefers the presigned MP4; HLS from archived media is the fallback while fragments exist.

Place-camera / on-prem producers are **out of scope** (YAML + local producer only).

## Playback

- **MP4**: short-lived presigned GET from `GET /api/incidents/{id}/live-video/playback` (`recordingDownloadUrl`). Do not log the URL.
- **HLS**: `GetDataEndpoint` + `GetHLSStreamingSessionURL` while the KVS stream still exists. URLs are **short-lived**. Safari often plays HLS in `<video>`; Chrome may need “open in new tab”.
- GetClip immediately after hang-up may return no fragments; the UI polls `processing` / HLS until export succeeds.

## Environment / feature flags

- **`ENABLE_LIVE_VIDEO`**: API must be `"true"` for live video routes.
- **`NEXT_PUBLIC_ENABLE_LIVE_VIDEO`**: Web UI feature gate (default on when unset).
- **`LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL`**: Default on. Set `false` to skip `UpdateMediaStorageConfiguration`.
- **`LIVE_VIDEO_EXPORT_TO_S3`**: Default on. Set `false` to keep fragments in KVS only.
- **TTL / limits**: `LIVE_VIDEO_SESSION_TTL_SECONDS`, `LIVE_VIDEO_MAX_DURATION_SECONDS`, `LIVE_VIDEO_HEARTBEAT_TIMEOUT_SECONDS`.
- **Tagging (`KVS_WEBRTC_TAG_APP`, `KVS_WEBRTC_TAG_ENV`)**: Applied to created video streams for cost/ownership.

## Browser / device

- **Caller**: Mobile browser; camera/mic permission required; **no login** (token in URL).
- **Dispatcher**: Authenticated workspace; KVS **viewer** path.

## Auditing

Key audit types include `live_video.requested`, `live_video.sms.sent`, `live_video.activated`, `live_video.storage_configured`, `live_video.ended`, `live_video.recording.exported`, `live_video.playback_accessed` (see `rapid-cortex-security` audit schema).

## Future extension points (not in current scope)

- Blur / privacy filter on sender or receiver.
- Snapshots to incident media.
- Unified incident media gallery.
- Responder or third-party sharing.
- F6 or cross-jurisdiction compatibility layers.
