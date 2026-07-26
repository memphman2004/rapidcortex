# Rapid Cortex Mobile (`apps/mobile`)

Expo SDK 52 React Native app for **RC Venue**, **RC Campus**, and (later) **RC Safe & Sound**.

## Setup

```bash
# from monorepo root
npm install
cp apps/mobile/.env.example apps/mobile/.env
# Set EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID (native app client, no secret)
cd apps/mobile && npx expo start
```

## Cognito

Native app client (no secret) on pool `us-east-1_0z6tA6WBs`:

- Client id: set `EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID` (dev: `rapid-cortex-native-dev`)
- Auth flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
- Callbacks include `rapidcortex://auth/callback` and `rapidcortex://oauth/callback`

## Backend contracts

Safe & Sound / Guardian / mobile codes handlers: `apps/api/src/handlers/safe-sound/` (+ guardian, mobile-codes).

**SAM:** registered on `infra/nested/stack-app-sam-qr.yaml` (stack 1 HttpApi). Deploy:

```bash
source scripts/env-api-dev.sh && ./scripts/deploy-lean-dev.sh dev --qr-only
```

## Products

| Path | Entry | Notes |
|------|--------|--------|
| Venue | Product card → staff login | Roles: `VENUE_*`, RC admins · route group `app/(venue)` |
| Campus | Product card → staff login | Roles: `CAMPUS_*`, RC admins · route group `app/(campus)` |
| Safe & Sound | Hidden unless `EXPO_PUBLIC_ENABLE_SAFE_SOUND=1` | BLE Home + Guardian (Stripe eSIM) · keep for later release |

## NFC (required for App Store / device write)

Configured in `app.config.ts` (Expo source of truth; not a separate `app.json`):

- iOS entitlement `com.apple.developer.nfc.readersession.formats: ["TAG"]` (not NDEF — ITMS-90778)
- `NFCReaderUsageDescription` for App Review
- Android `NFC` permission + `react-native-nfc-manager` plugin

NFC write does **not** work in Expo Go or the simulator. Use a development client:

```bash
cd apps/mobile
eas build --platform ios --profile development
```

## Splash

Native splash + in-app gate match marketing `/enter` (“Enter the Cortex”): background `#00040e`, neural field animation, Initialize CTA. Shown once every 24 hours (same TTL as the marketing `cortex_entered` cookie).

## App Store / TestFlight (v1 — QR/NFC Venue + Campus)

First submission is the **field codes tool only** (camera + NFC + Face ID). Guardian / Safe & Sound BLE and background-location permissions are **omitted** from `app.config.ts` to avoid App Review rejection; reintroduce them in a later release when that product is demoable.

### Before first EAS build

```bash
cd apps/mobile
npx eas-cli login          # must be an account in the Expo org matching `owner` in app.config.ts
npx eas-cli init          # writes real `extra.eas.projectId` (replaces REPLACE_WITH_EAS_PROJECT_ID)
```

Confirm `owner: 'rapid-cortex'` matches the org slug at [expo.dev/accounts](https://expo.dev/accounts).

Android: `google-services.json` is optional for v1 (only needed for Firebase push). The config wires it only if the file exists.

## Not App Store ready until

- [x] Real icons / splash (marketing-matched)
- [x] Cognito mobile client ID in `.env` (dev native client)
- [x] SAM routes for safe-sound / guardian / codes (QR stack)
- [x] NFC entitlements + usage description
- [x] Guardian/BLE/background location stripped for QR/NFC-only review
- [ ] EAS project ID (`eas init`) + store credentials
- [ ] Physical device testing (NFC write on NTAG213)
- [ ] Stripe publishable key for Guardian PaymentSheet (Safe & Sound release)
