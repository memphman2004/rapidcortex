# Escort iQ™ — Architecture Inventory (Phase 1)

**Product:** Escort iQ™ from NexCort iQ  
**Vertical:** Higher-education Campus only (never K-12 / venue / transit / PSAP)  
**Default:** DISABLED until `ENABLE_ESCORT_IQ` / `NEXT_PUBLIC_ENABLE_ESCORT_IQ` and campus admin enablement  

## Reusable

| Capability | Paths |
|---|---|
| QR/NFC engage + public report | `apps/api/src/qr-nfc/*`, `qr-nfc-intake-client.tsx` |
| Campus incidents | `campus-incident-service.ts`, `CampusIncidentsTable` |
| Pinpoint iQ GPS + LIVE/SCAN_ONLY/STALE | `pinpointService.ts`, `location-status.ts`, `campus-live-location-share.tsx` |
| Institution split | `institution-type.ts`, `campusProductFromRole`, `applyCampusInstitutionNav` |
| Campus nav / settings | `role-nav.ts`, `CampusSettingsClient.tsx` |
| Fail-closed flags | `featureEnabled(name, false)`, web `envFlag` default-off list |
| Video Assist / Silent Text / Voice Bridge | Existing PSAP-oriented services — extend carefully, do not claim full campus wire-up until tested |
| Maps | `rapid-cortex-maps` + Pinpoint dispatcher live |

## Extend

- Engage payload + ScanIntentChooser for Escort entry (higher_ed only)
- Campus settings (`CampusAgencyConfig.escortIq`)
- Campus nav (higher_ed + feature gate)
- Pinpoint inline share linked to escort session (no plaintext token on session)
- Continuity Log: **new campus escort handoff surface** (not Clery DCL / not PSAP RCS)

## New

- Escort session domain (schemas, repo, service, HTTP)
- Student public escort UX (`/escort/t/{token}`)
- Campus ops Escort iQ queue/detail
- Independent oversight (supervisor, private check-ins, dual arrival)
- Server-side ETA / check-in timers (EventBridge) — later phase
- Personnel mobile assignment workflow — later phase

## Dependencies

DynamoDB (reuse `CampusIncidentsTable` with `ESCORT#` SK), Cognito, PinpointLinksTable, optional SMS/Video Assist/Voice Bridge, SAM stack-app-sam-5 for HTTP registration.

## Explicit non-goals in Phase 2–3

- Production deploy
- Full independent-oversight timers
- Claiming browser voice calling without Voice Bridge verification
- K-12 exposure

## Implementation status (current slice)

| Area | Status |
|---|---|
| Shared gates + schemas | Done (`packages/shared/src/campus/escort-iq/`) |
| Fail-closed flags | Done (`ENABLE_ESCORT_IQ` / `NEXT_PUBLIC_ENABLE_ESCORT_IQ`) |
| Session create + list service | Done (Dynamo `ESCORT#` on CampusIncidentsTable) |
| Engage `escortIqAvailable` | Done |
| Student QR entry + request form | Done (chooser + `EscortIqLanding`) |
| Campus ops queue page | Done (UI; requires API route registration) |
| Settings mapper `escortIq` | Done |
| Higher-ed-only nav | Done |
| SAM HttpApi route registration | **Pending** — register `escort-iq-http` on stack-app-sam-qr / sam-5 before deploy |
| Independent oversight (dual confirm, private check-ins, ETA timers) | Not started (Phase 6–7) |
| Continuity Log escort handoff | Not started |

### Enablement checklist (dev only)

1. `ENABLE_ESCORT_IQ=true` on API Lambdas  
2. `NEXT_PUBLIC_ENABLE_ESCORT_IQ=1` on web  
3. Campus Settings → Escort iQ → enabled (higher_ed tenant)  
4. Deploy SAM routes for `/api/public/escort-iq` and `/api/campus/{campusCode}/escort-iq`
