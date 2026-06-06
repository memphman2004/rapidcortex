# Kinesis Video Streams WebRTC (live + optional recording)

Rapid Cortex live video can use **Amazon Kinesis Video Streams (KVS)** for WebRTC: a **signaling channel** is required for live sessions. If you also want **saving/ingestion to the cloud**, you need a Kinesis **video** stream, positive **data retention**, and a **media storage configuration** that maps the signaling channel to that stream.

## Two building blocks

1. **Signaling channel (required for this integration path)**  
   Used for WebRTC signaling. The API may create a **per-session** channel (for example `rc-live-<sessionId>`) or you can pre-provision a **named** channel for operators/staging (see scripts below).

2. **Kinesis video stream (optional, for `kvs`-style recording)**  
   A separate *media* stream with **data retention in hours** &gt; 0. The signaling channel is linked to it with `UpdateMediaStorageConfiguration`.

## Storage mode and connection behavior

- **Storage disabled (live-only)**  
  `LIVE_VIDEO_STORAGE_MODE=off` (or `LIVE_VIDEO_STORAGE_MODE=off` in the request payload override). **Direct** WebRTC (single-master) connections use `ConnectAsMaster` / `ConnectAsViewer` style clients.

- **Storage enabled (live + Kinesis ingestion)**  
  `LIVE_VIDEO_STORAGE_MODE` set to `kvs` or `kvs-ingestion` (or request override). In AWS, after **storage is ENABLED** on a channel, **plain peer-to-peer master/viewer on that channel is not used**; clients must use **Join storage session** flows (the app’s WebRTC path is designed for this when `LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL=true`).

See AWS documentation for the exact `JoinStorageSession` / storage viewer APIs.

## CLI scripts (operators)

From the repo root (AWS CLI v2, credentials in profile or environment):

```bash
export AWS_REGION=us-east-1
export KVS_SIGNALING_CHANNEL_NAME=rc-staging-live
export KVS_ENABLE_STORAGE=true
export KVS_VIDEO_STREAM_NAME=rc-staging-lvstream
export KVS_STREAM_RETENTION_HOURS=24
./scripts/setup-kvs-webrtc.sh
./scripts/check-kvs-webrtc.sh
```

- **setup-kvs-webrtc.sh**  
  Idempotently creates or reuses the **signaling channel** and, when `KVS_ENABLE_STORAGE=true`, creates or reuses the **video** stream, then sets `UpdateMediaStorageConfiguration` to **ENABLED** with that stream.  
  When `KVS_ENABLE_STORAGE=false`, it sets storage to **DISABLED** on the channel (best effort if the API allows).

- **check-kvs-webrtc.sh**  
  - `describe-signaling-channel`  
  - `get-signaling-channel-endpoint` (MASTER and VIEWER, WSS+HTTPS)  
  - `describe-media-storage-configuration` (ENABLED / DISABLED and `StreamARN` when present)  
  - optional `describe-mapped-resource-configuration` (requires `KVS_VIDEO_STREAM_NAME`)  
  - `describe-stream` with retention check when the stream name is set  

  Set `KVS_CHECK_EXPECT_STORAGE=true` to **fail** if storage is not **ENABLED** (for production-like checks). Exit code **1** on failure.

### Disable storage (CLI)

```bash
export KVS_ENABLE_STORAGE=false
./scripts/setup-kvs-webrtc.sh
```

Or in the **AWS console**: Kinesis Video Streams → your signaling channel → **Media storage** → edit.

### Manual console checks

- **Signaling channel**: Kinesis Video Streams → **Signaling channels** → open channel → note ARN.  
- **Stream**: **Video streams** → retention, ARN.  
- **Mapping**: channel detail page → **Media storage** → status and target stream.

## Application configuration (summary)

| Variable | Role |
|----------|------|
| `ENABLE_LIVE_VIDEO` | `true` to enable live video API routes. |
| `LIVE_VIDEO_SESSIONS_TABLE` | DynamoDB table for sessions. |
| `LIVE_VIDEO_PUBLIC_BASE_URL` | Public web origin for links in SMS. |
| `LIVE_VIDEO_KVS_TOKEN_ROLE_ARN` | IAM role assumed for **scoped** browser credentials (required for the KVS WebRTC path). |
| `LIVE_VIDEO_STORAGE_MODE` | `off` = no `CreateStream` / no ingestion; `kvs` or `kvs-ingestion` = optional stream + mapping when the feature flags align. |
| `LIVE_VIDEO_KVS_DATA_RETENTION_HOURS` | Retention for *API-created* per-session Kinesis **video** streams. |
| `LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL` | `true` to call `UpdateMediaStorageConfiguration` and enable AWS storage on the per-session channel (changes WebRTC mode). |
| `NEXT_PUBLIC_ENABLE_LIVE_VIDEO` | Web: enable UI surfaces. |

`SMS_PROVIDER` and `TWILIO_SECRET_ARN` / `INCIDENT_MEDIA_TWILIO_SECRET_ARN` are unchanged; SMS uses the existing factory.

**Note:** Production sessions typically create a **new** signaling channel per request; the CLI scripts are for **shared** channel/stream names, staging, and validation—not a substitute for the API’s per-session resources.

## Alarms and IAM

- CloudWatch alarms for live video and SMS routing live in `infra/template.yaml` (e.g. Lambda `Errors` and SMS routing filter metrics).  
- Lambdas and the KVS **browser** role include Kinesis data-plane actions including `JoinStorageSession` and `JoinStorageSessionAsViewer` where required.

## Tests

- Shell scripts: `bash -n scripts/setup-kvs-webrtc.sh scripts/check-kvs-webrtc.sh`  
- API: Vitest coverage under `apps/api` for `liveVideoService`, KVS helper modules, and repository behavior.
