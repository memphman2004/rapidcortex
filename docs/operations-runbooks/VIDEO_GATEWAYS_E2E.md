# Video gateways — stage matrix & E2E smoke

Ops checklist for making every video path complete and robust. Account `158961537080` only.

**Product policy (iQ Vision vs Connect):** Nest and Wyze stay on the **Connect** HTTP/UI surface (`/api/cameras/providers/*`). They are **not** `VisionProvider` enum values and are not registered in Vision `ProviderRegistry`. Caller phone share stays Video Assist / Live Video; Vision may optionally bridge an active caller session via `CallerVideoProvider` when `ENABLE_RAPID_VISION_CALLER_VIDEO` is on. Ring **cameras** remain suspended (Neighbors webhook is unrelated).

Canonical architecture: [LIVE_VIDEO_KVS.md](../product-architecture/LIVE_VIDEO_KVS.md), [LIVE_VIDEO_V2.md](../product-architecture/LIVE_VIDEO_V2.md), [MILESTONE_XPROTECT_BRIDGE.md](../product-architecture/MILESTONE_XPROTECT_BRIDGE.md).

---

## 1. Per-stage enablement matrix

| Capability | Env / flag (canonical) | Staging (`env-api-staging.sh`) | Live (`env-api-dev.sh` → app.rapidcortex.us) | Notes |
|---|---|---|---|---|
| Video Assist (P2P) | `VIDEO_ASSIST_TABLE`, `VIDEO_ASSIST_PUBLIC_BASE_URL`, TURN | Must set TURN | Must set TURN | No `NEXT_PUBLIC_ENABLE_VIDEO_ASSIST`; panel always mounted |
| Live Video (KVS) | `ENABLE_LIVE_VIDEO`, `ENABLE_LIVE_VIDEO_RESOURCES`, `LIVE_VIDEO_*` | `true` / `true` | `true` / `true` | CFN `EnableLiveVideoResources` must be true or Lambdas absent |
| Live Video STS | `LIVE_VIDEO_KVS_TOKEN_ROLE_ARN` | Required for KVS path | Required | Without role → legacy P2P + TURN |
| TURN / ICE | `WebrtcTurnSecretArn` / `WEBRTC_TURN_SECRET_ARN` / `WEBRTC_ICE_SERVERS_JSON` | Required on staging/dev/pilot/prod | Required | Assist create fails closed (`VIDEO_ASSIST_TURN_REQUIRED`) |
| RC Video wall | `ENABLE_RC_VIDEO` / `NEXT_PUBLIC_ENABLE_RC_VIDEO` | Default on | Default on | |
| Video gateway PTZ | `VIDEO_GATEWAY_URL`, `VIDEO_GATEWAY_SECRET_ARN` | Empty in parent template → **mock** | Empty → **mock** | Set non-empty for real PTZ |
| RC analytics / attach | `ENABLE_RC_VIDEO_ANALYTICS`, `ENABLE_RC_VIDEO_ATTACH_STORAGE` | Default **off** | Default **off** | Pilot decision |
| Milestone | `ENABLE_MILESTONE_XPROTECT`, bridge URL + HMAC secret | Needs on-prem bridge | Needs bridge | `MILESTONE_MOCK` must not invent cameras |
| Nest Connect | `ENABLE_CONNECT_NEST` / `NEXT_PUBLIC_ENABLE_CONNECT_NEST` | `true` | `true` | SDM secrets + redirect URI |
| Wyze Connect | `ENABLE_CONNECT_WYZE` / `NEXT_PUBLIC_ENABLE_CONNECT_WYZE` | Check script | **fail-closed `false`** in `env-api-dev.sh` | Docs sometimes say `WYZE_INTEGRATION_ENABLED` — prefer `ENABLE_CONNECT_*` |
| Rapid Vision | `ENABLE_RAPID_VISION` + nested flags | Default on | Default on | |
| Vision Nest/Wyze UI flags | `ENABLE_RAPID_VISION_NEST` / `_WYZE` | Nested under Connect | Nested under Connect | Does **not** register Vision providers |
| Vision caller bridge | `ENABLE_RAPID_VISION_CALLER_VIDEO` | Default on | Default on | Registry bridge only |
| Vision demo | `ENABLE_RAPID_VISION_DEMO`, optional `VISION_DEMO_KVS_CHANNEL_NAME` | | | Demo WebRTC needs real/ensured KVS channel |
| Vision transcript | `ENABLE_RAPID_VISION_TRANSCRIPT`, `VISION_TRANSCRIPT_MOCK`, `FfmpegLayerArn` | Mock if no ffmpeg layer | Mock until LIVE smoke | Keep mock until browser LIVE tab verified |
| Ring cameras | *(none live)* | Suspended | Suspended | Do not re-enable; Neighbors webhook only |

**BFF routing:** Assist → `API_UPSTREAM_BASE_3`; Live Video / media / wall / stream → `API_UPSTREAM_BASE_5`; Vision → `API_UPSTREAM_BASE_2`.

---

## 2. Caller-share smoke (Video Assist)

Prereqs: TURN secret, SMS (or `SMS_MOCK=1` in lab), `VIDEO_ASSIST_PUBLIC_BASE_URL`, dispatcher with `workspace.live_video`.

1. Open an active incident as dispatcher/supervisor.
2. Video Assist panel → create session with caller E.164 (not the Pinpoint origination number).
3. Confirm SMS (or mock log) contains public `/video-assist/{token}` link.
4. On a **cellular** phone: open link → consent → allow camera/mic → connecting → live.
5. Dispatcher sees remote stream; cancel/end from both sides; session closes without orphan signals.
6. Resend path when first SMS failed (`status=failed`).

Fail if: create returns `VIDEO_ASSIST_TURN_REQUIRED`, ICE stuck on cellular, or BFF hits stack 5 instead of stack 3.

---

## 3. Caller-share smoke (Live Video KVS)

Prereqs: AppSam5 live-video resources deployed, `LIVE_VIDEO_KVS_TOKEN_ROLE_ARN`, region aligned with `AWS_REGION`, SMS.

1. Dispatcher **Caller Mobile** → Request live video (stack 5 BFF).
2. Caller opens `/media/live/{token}` → JoinStorageSession (master) when storage attach on.
3. Dispatcher JoinStorageSessionAsViewer → live A/V.
4. Hang up → GetClip export worker → playback URL / HLS until export completes.
5. Confirm KVS console shows `rc-live-*` / `rc-lvsv-*` in the **same region**.

Fail if: `EnableLiveVideoResources=false`, wrong region, silent live-without-recording when attach is on.

---

## 4. Facility SOC smoke (wall / PTZ / Milestone)

Prereqs: cameras in campus/venue/transit registry with `kvsChannelName`; optional `VIDEO_GATEWAY_*` for PTZ; Milestone bridge for XProtect sites.

1. Open campus/venue/transit **Cameras** → registry CRUD (admin/supervisor).
2. Open **Video wall** → layout → tile viewer-token stream plays.
3. PTZ-capable camera: move/zoom; response `mock: false` only when gateway URL+secret set.
4. DVR: fragments / clip export when recording exists.
5. Milestone (if used): health → sync cameras → live HLS ticket or KVS fallback; mock must not invent cameras.

Fail if: transit nav still lands on catch-all dashboard; PTZ `mock: true` when expecting live gateway.

---

## 5. Home-camera smoke (Nest / Wyze)

**Nest:** agency OAuth in admin integrations → device list → request access → citizen consent → answer-stream → stop → agency disconnect.  
**Wyze:** enable `ENABLE_CONNECT_WYZE` on a controlled stage after secret rotation → marketing `/connect/wyze/start` enroll → consent → request → answer-stream → `POST /api/cameras/providers/wyze/unregister` with `{ ownerId }`.

`GET /api/cameras/providers` lists Nest and Wyze when their Connect flags are on (Connect catalog — not Vision providers).

UI hosts: dispatcher Media, campus/venue cameras, transit cameras connect client.

---

## 6. Rapid Vision smoke

1. Discover cameras (demo seed OK — device `demo-device-001` requires consent; others auto-authorize).
2. Request access → if consent, use `approveUrl` from the 202 body (token matches store) or `/api/public/vision/consent/{token}/…`.
3. Viewer-token → WebRTC when `kvsChannelName` is set (`VISION_DEMO_KVS_CHANNEL_NAME` or `rc-vision-demo-{agency}-{cameraId}`).
4. Transcript start → segments in LIVE tab (`VISION_TRANSCRIPT_MOCK` stays on until FFmpeg layer + this smoke).
5. `POST /api/incidents/{id}/vision/sessions/{sessionId}/revoke` → status `revoked`.
6. Confirm Nest/Wyze remain Connect-only (`getVisionProvider` only returns `demo` / `caller_video`).


---

## Flag vocabulary

| Prefer (code) | Avoid / docs drift |
|---|---|
| `ENABLE_CONNECT_NEST` / `NEXT_PUBLIC_ENABLE_CONNECT_NEST` | — |
| `ENABLE_CONNECT_WYZE` / `NEXT_PUBLIC_ENABLE_CONNECT_WYZE` | `WYZE_INTEGRATION_ENABLED` |
| *(no live Ring camera flag)* | `RING_INTEGRATION_ENABLED` (documentary suspension only) |
