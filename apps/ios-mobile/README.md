# Rapid Cortex Mobile — iOS

Native SwiftUI installer for campus and venue QR / NFC codes.

This is **not** the Expo app. The Android product is Expo in [`apps/android-mobile`](../android-mobile). Use this Xcode project for iOS.

| | |
|---|---|
| Bundle ID | `us.rapidcortex.field` |
| Display name | Rapid Cortex Mobile |
| Minimum OS | iOS 16 (iPhone only) |
| Auth | Same Cognito pool and native client as Android (`USER_SRP_AUTH`) |
| API | `https://api.rapidcortex.us` (`GET/POST /api/codes`, NFC write log) |
| Store | **Unlisted** App Store + TestFlight invite |

## Open in Xcode

```bash
cd apps/ios-mobile
xcodegen generate   # regenerates RapidCortexField.xcodeproj from project.yml
open RapidCortexField.xcodeproj
```

1. Signing & Capabilities → Team **6D7D94PU3M** (Apps on Demand).
2. Enable **Near Field Communication Tag Reading** on App ID `us.rapidcortex.field` in the Apple Developer portal (the entitlements file already requests `TAG` only — do not add `NDEF`; Apple rejects it).
3. Run on a **physical iPhone**. The Simulator cannot write NFC tags.

Config defaults live in `Config/Config.example.xcconfig` (public native Cognito client, no secret). Copy to `Config/Config.xcconfig` only if you need local overrides.

## TestFlight (unlisted)

1. App Store Connect → New App → bundle `us.rapidcortex.field`, name **Rapid Cortex Mobile**.
2. Pricing and Availability → **Unlisted App Distribution** (invite / direct link, not searchable).
3. Archive in Xcode → Distribute App → App Store Connect.
4. TestFlight → Internal (up to 100) and/or External group. Share the redeem / invite link. No public listing.

Users sign in with the **same email and password** already in Cognito (`us-east-1_0z6tA6WBs`, client `3nkemnrffspnaa0ikp2un6koh0`). Admin accounts that require TOTP will see the MFA sheet.

## Apple review

Unlisted App Store listing. Bundle `us.rapidcortex.field`. Version **1.0.0**. Increment **build** on every upload.

### Listing (App Store Connect)

| Field | Value |
|---|---|
| Name | Rapid Cortex Mobile |
| Subtitle | NFC & QR Code Installer |
| Category | Business |
| Age rating | 4+ |
| Price | Free |
| Availability | **Unlisted App Distribution** (invite / direct link, not searchable) |
| Privacy policy | https://www.rapidcortex.us/privacy |
| Support URL | https://www.rapidcortex.us |
| Support email | support@rapidcortex.us |
| Encryption | Uses only HTTPS / standard iOS crypto (`ITSAppUsesNonExemptEncryption` = false) |
| Nutrition label | Email Address — linked to identity — App Functionality — not used for tracking |

### Seed the review login (before Submit)

Uses campus admin on `test-campus-uga` so Apple lands on **QR / NFC Codes**, not the 911 console.

```bash
source scripts/env-api-dev.sh
export RAPID_CORTEX_TEST_TEMP_PASSWORD='…'   # 12+ chars, upper, lower, number, symbol
npx tsx scripts/seed-role-test-users.ts
bash scripts/seed-qr-nfc-test-campus.sh      # at least one code on Codes
```

Confirm `test-campus-uga` exists (`bash scripts/seed-vertical-agencies.sh` if needed). MFA is disabled for `apple-review@rapidcortex.us` only. Paste the same password into the notes below — do not commit it.

### Review notes (paste into App Store Connect)

```
Rapid Cortex Mobile is a B2B / B2G field tool for campus and venue staff who install QR codes and NFC location tags for Rapid Cortex. It is not a public consumer app. Distribution is Unlisted App (invite / direct link only).

There is no self-registration. Agencies provision accounts during onboarding. Users cannot create an account in the app, so account deletion is handled by the agency administrator or Rapid Cortex support at support@rapidcortex.us.

DEMO ACCOUNT (MFA disabled):
Email: apple-review@rapidcortex.us
Password: [paste RAPID_CORTEX_TEST_TEMP_PASSWORD]
Role: Campus Admin on test-campus-uga

This account opens the QR / NFC installer (Codes, Create, Settings). It does not open a 911 dispatch console.

TEST STEPS:
1. Sign in. You land on Codes. Sign-in states there is no in-app sign-up.
2. Tap a location code to view the QR image and URL.
3. Tap Share or Save to Photos to export the QR.
4. Tap Program NFC Tag. The iOS NFC sheet appears. If you have an NTAG213, hold it to the top of the iPhone. If you do not, tap Cancel — that is expected.
5. Open the Create tab, enter a name and zone, and save a new code.
6. Open Settings and open Privacy Policy and Terms of Use.

NFC: Core NFC writes an NDEF URI to NTAG213 stickers (entitlement format TAG). NFC write requires a physical iPhone; Simulator cannot write tags.

Privacy policy: https://www.rapidcortex.us/privacy
Support: support@rapidcortex.us
```

### Still required in App Store Connect (not in git)

1. Create the app record if it does not exist (bundle `us.rapidcortex.field`, SKU e.g. `rc-mobile-ios`).
2. Enable **Near Field Communication Tag Reading** on the App ID; entitlement is `TAG` only — do not add `NDEF`.
3. Archive in Xcode → Distribute App → App Store Connect.
4. Screenshots (iPhone 6.7" required): login, Codes list, code detail with QR, Create, Settings with legal links.
5. Paste the review notes and demo password.
6. Submit for review.

## SPM

[BigInt](https://github.com/attaswift/BigInt) is required for Cognito SRP. Xcode resolves it from `project.yml` when you first open the project.

## Spec

Pixel and protocol notes: [`CURSOR_RC_FIELD_IOS.md`](./CURSOR_RC_FIELD_IOS.md) (also copied to the repo root).
