# NexCort iQ — HeyGen training narratives

Spoken scripts for avatar videos. Paste the **Narration** block into HeyGen. Use **On-screen cues** for B-roll / screen capture overlays.

**Pace:** ~135 words/minute. Target durations match `apps/web/lib/help/video-library.ts`.

| # | File | Audience | Target |
|---|---|---|---|
| 01 | [01-call-assist-operator-live-takeover.md](./01-call-assist-operator-live-takeover.md) | Call Assist | 6:00 |
| 02 | [02-call-assist-emergency-transfer.md](./02-call-assist-emergency-transfer.md) | Call Assist | 5:00 |
| 03 | [03-dispatcher-workspace-tour.md](./03-dispatcher-workspace-tour.md) | PSAP | 5:00 |
| 04 | [04-dispatcher-first-incident-cad.md](./04-dispatcher-first-incident-cad.md) | PSAP | 7:00 |
| 05 | [05-dispatcher-silent-text.md](./05-dispatcher-silent-text.md) | PSAP | 4:00 |
| 06 | [06-campus-overview-when-to-call-911.md](./06-campus-overview-when-to-call-911.md) | Campus | 6:00 |
| 07 | [07-venue-overview-when-to-call-911.md](./07-venue-overview-when-to-call-911.md) | Venue | 5:00 |
| 08 | [08-transit-overview-when-to-call-911.md](./08-transit-overview-when-to-call-911.md) | Transit | 6:00 |
| 09 | [09-dispatcher-video-pinpoint.md](./09-dispatcher-video-pinpoint.md) | PSAP | 6:00 |
| 10 | [10-supervisor-floor-cad-approval.md](./10-supervisor-floor-cad-approval.md) | Supervisor | 6:00 |
| 11 | [11-agency-admin-users-sop.md](./11-agency-admin-users-sop.md) | Agency Admin | 8:00 |
| 12 | [12-venue-guest-services-walkthrough.md](./12-venue-guest-services-walkthrough.md) | Venue Guest Services | 4:00 |
| 13 | [13-transit-operator-shift.md](./13-transit-operator-shift.md) | Transit Operator | 5:00 |
| 14 | [14-hospital-capacity-prealert.md](./14-hospital-capacity-prealert.md) | Hospital | 6:00 |
| 15 | [15-rc-agency-onboard.md](./15-rc-agency-onboard.md) | RC Admin | 7:00 |

## HeyGen settings (recommended)

- Avatar: professional, calm public-safety tone (neutral accent)
- Background: dark charcoal / deep navy to match product UI
- Captions: on; burn-in for PSAP seats that mute audio
- Do **not** show fabricated agency logos or fake CAD screenshots of real PSAPs

## After publish

1. Host MP4 on help CDN / S3.
2. Set `status: "live"` and `url` in `apps/web/lib/help/video-library.ts`.
