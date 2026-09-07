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

## SPM

[BigInt](https://github.com/attaswift/BigInt) is required for Cognito SRP. Xcode resolves it from `project.yml` when you first open the project.

## Spec

Pixel and protocol notes: [`CURSOR_RC_FIELD_IOS.md`](./CURSOR_RC_FIELD_IOS.md) (also copied to the repo root).
