# Rapid Cortex Android mobile (`apps/android-mobile`)

Expo SDK 52 React Native app for **RC Venue**, **RC Campus**, and (later) **RC Safe & Sound**.

This is the **Android** product (Play package `us.rapidcortex.app`). Native **iOS** is Xcode in [`apps/ios-mobile`](../ios-mobile) (Rapid Cortex Mobile) — do not ship Expo iOS builds.

## Setup

```bash
# from monorepo root
npm install
cp apps/android-mobile/.env.example apps/android-mobile/.env
# Set EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID (native app client, no secret)
cd apps/android-mobile && npx expo start --android
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

## NFC (required for Play / device write)

Configured in `app.config.ts` (Expo source of truth; not a separate `app.json`):

- Android `NFC` permission + `react-native-nfc-manager` plugin
- iOS NFC is native Core NFC in [`apps/ios-mobile`](../ios-mobile)

NFC write does **not** work in Expo Go or the emulator. Use a development client or `expo run:android` on a physical device:

```bash
cd apps/android-mobile
eas build --platform android --profile development
```

## Splash

Native splash + in-app gate match marketing `/enter` (“Enter the Cortex”): background `#00040e`, neural field animation, Initialize CTA. Shown once every 24 hours (same TTL as the marketing `cortex_entered` cookie).

## Play Store (v1 — QR/NFC Venue + Campus)

First submission is the **field codes tool only** (camera + NFC). Guardian / Safe & Sound BLE stays flag-gated. iOS Rapid Cortex Mobile ships from Xcode / TestFlight (`apps/ios-mobile`), not EAS.

### Before first EAS build

```bash
cd apps/android-mobile
npx eas-cli login          # must be an account in the Expo org matching `owner` in app.config.ts
npx eas-cli init          # writes real `extra.eas.projectId` (replaces REPLACE_WITH_EAS_PROJECT_ID)
```

Confirm `owner: 'rapid-cortex'` matches the org slug at [expo.dev/accounts](https://expo.dev/accounts).

### Store account IDs

| Store | ID | Notes |
|-------|-----|--------|
| Google Play Console | Developer account `7807903929046926180` | Org **Rapid Cortex**; finish identity / website / phone verification before API access + publish |
| Apple (iOS) | Team `6D7D94PU3M` | Rapid Cortex Mobile in `apps/ios-mobile`, unlisted TestFlight |

Android EAS submit expects a Play API service-account JSON at `apps/android-mobile/google-play-key.json` (do not commit). Create it under Play Console → **Users and permissions → API access** after account verification is complete.

Android: `google-services.json` is optional for v1 (only needed for Firebase push). The config wires it only if the file exists.

## Not Play-ready until

- [x] Real icons / splash (marketing-matched)
- [x] Cognito mobile client ID in `.env` (dev native client)
- [x] SAM routes for safe-sound / guardian / codes (QR stack)
- [x] NFC entitlements + usage description
- [x] Guardian/BLE/background location stripped for QR/NFC-only review
- [ ] EAS project ID (`eas init`) + store credentials
- [ ] Physical device testing (NFC write on NTAG213)
- [ ] Stripe publishable key for Guardian PaymentSheet (Safe & Sound release)
