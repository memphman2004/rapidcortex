# Rapid Cortex Mobile (`apps/mobile`)

Expo SDK 52 React Native app for **RC Safe & Sound** and **Venue / Campus** field tools.

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
| Safe & Sound | Product card → consumer auth | BLE Home + Guardian (Stripe eSIM) |
| Venue / Campus | Product card → staff login | Roles: `VENUE_*`, `CAMPUS_*`, RC admins |

## Splash

Native splash + in-app gate match marketing `/enter` (“Enter the Cortex”): background `#00040e`, neural field animation, Initialize CTA. Shown once every 24 hours (same TTL as the marketing `cortex_entered` cookie).

## Not App Store ready until

- [x] Real icons / splash (marketing-matched)
- [x] Cognito mobile client ID in `.env` (dev native client)
- [x] SAM routes for safe-sound / guardian / codes (QR stack)
- [ ] EAS project ID + store credentials
- [ ] Physical device testing (NFC, BLE, background location)
- [ ] Stripe publishable key for Guardian PaymentSheet
