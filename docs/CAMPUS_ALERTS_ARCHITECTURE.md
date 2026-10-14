# NexCort iQ Campus Alerts — Architecture

**Product:** NexCort iQ Campus Alerts  
**Student CTA:** Register / Renew Notifications  
**Vertical:** Higher-education Campus only (never K-12 / venue / transit / PSAP)  
**Default:** DISABLED until `ENABLE_CAMPUS_ALERTS` / `NEXT_PUBLIC_ENABLE_CAMPUS_ALERTS` and tenant `campusAlerts.enabled`

**Do not confuse with:** Vertical Alerts / ENS Test Program, Escort iQ, or marketing Business SMS consent.

## Product policy (authoritative)

| Channel | Allowed? |
|---|---|
| Individual OTP SMS (register / renew / phone change) | **Yes** — transactional |
| Mass SMS for annual renewal / 30-day / 7-day reminders | **No** |
| Mass SMS for routine / advisory / newsletter | **No** |
| Mass SMS for `EMERGENCY`, `EMERGENCY_UPDATE`, `ALL_CLEAR` (if enabled) | **Yes** — authorized human only |
| Autonomous / AI-published emergency broadcasts | **No** |

Annual renewal outreach uses university email, instructors, newsletters, portal banners, and QR/NFC Information tab copy. Dashboard exposes downloadable templates via `GET .../renewal-outreach`.

Mass SMS is institution-billable. Confirmation requires explicit emergency + billing acknowledgment. Cost figures are **estimates**.

### Billing modes

- **nexcort_managed** — provider bills NexCort iQ; usage ledger attributes cost to the university for invoicing.
- **university_managed_provider** — university-owned messaging account; dashboard copy reflects direct provider billing.

## Implementation map

| Area | Location |
|---|---|
| Gates / classifications / cost | `packages/shared/src/campus/campus-alerts/` |
| Subscriber + campaign Dynamo | `apps/api/src/campus/campus-alerts/` (`CASUB#`, `CASUB_CAMPAIGN#`, `CASUB_PREVIEW#`) |
| Public OTP | `POST /api/public/campus-alerts/*` |
| Staff metrics / emergency / usage | `GET|POST /api/campus/{code}/campus-alerts...` |
| QR Information tab CTA | `campus-info-tab-panel.tsx` + intake client |
| Ops UI + confirm dialog | `CampusAlertsOpsClient.tsx`, `campus-alerts-emergency-confirm-dialog.tsx` |

## Classification enforcement

`isCampusAlertsMassSmsClassification()` — only `EMERGENCY` | `EMERGENCY_UPDATE` | `ALL_CLEAR`.  
`ANNUAL_RENEWAL`, `ROUTINE`, `SAFETY_ADVISORY`, `TEST` are rejected in `previewEmergencyBroadcast` / `confirmEmergencyBroadcast` / `selectEligibleForBroadcast`.

Roles: `CAMPUS_ADMIN` | `CAMPUS_SUPERVISOR` | `CAMPUS_DISPATCH` (+ RC internal). Not `CAMPUS_SECURITY`.

## Known limitations

- Emergency send is synchronous in-Lambda (throughput/SQS fan-out for large campuses is a follow-up).
- Dual authorization records `approvedByUserId` but does not yet verify the approver JWT separately.
- Reconciled carrier charges are ledger fields; provider settlement import is not automated.
- Escort iQ unchanged.

**Do not deploy to production without explicit approval.**
