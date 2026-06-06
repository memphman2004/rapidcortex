# Live Video V2 rollout

## Required configuration

- `ENABLE_LIVE_VIDEO=true` (API)
- `LIVE_VIDEO_SESSIONS_TABLE=<dynamodb table name>`
- `LIVE_VIDEO_SESSION_TTL_SECONDS=1800` (or agency policy)
- `LIVE_VIDEO_MAX_DURATION_SECONDS=900`
- `LIVE_VIDEO_HEARTBEAT_TIMEOUT_SECONDS=45`
- `LIVE_VIDEO_PUBLIC_BASE_URL=https://rapidcortex.us` (or stage host)
- `NEXT_PUBLIC_ENABLE_LIVE_VIDEO=1` (web)

## SMS delivery

- Uses existing `SMS_PROVIDER` routing (`aws|twilio|auto|mock`) via shared factory.
- Twilio secrets remain in Secrets Manager (`TWILIO_SECRET_ARN` / legacy ARN).
- SMS content remains transactional and incident-safe.

## Browser/device expectations

- Caller: modern mobile browser with camera + microphone permissions.
- Dispatcher: modern desktop browser with WebRTC support.
- If ICE/TURN is needed, provide `WEBRTC_TURN_SECRET_ARN` and server-side TURN config handling.

## Timeout and closure behavior

- Session token expires at `expiresAt`.
- Caller/dispatcher heartbeats refresh liveness.
- Session can be ended manually by dispatcher, by caller heartbeat `markEnded`, or by timeout expiry.

## Future extensions

- Blur/privacy controls for caller stream
- Recording/archive policy and storage
- Responder fan-out / multi-party rooms
- Cross-jurisdiction sharing compatibility
