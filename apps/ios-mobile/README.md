# NexCort iQ Mobile — iOS

Native SwiftUI installer for campus and venue QR / NFC codes.

This is **not** the Expo app. The Android product is Expo in [`apps/android-mobile`](../android-mobile). Use this Xcode project for iOS.

| | |
|---|---|
| Bundle ID | `us.rapidcortex.field` |
| Display name | NexCort iQ Mobile |
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

1. App Store Connect → New App → bundle `us.rapidcortex.field`, name **NexCort iQ Mobile**.
2. Pricing and Availability → **Unlisted App Distribution** (invite / direct link, not searchable).
3. Archive in Xcode → Distribute App → App Store Connect.
4. TestFlight → Internal (up to 100) and/or External group. Share the redeem / invite link. No public listing.

Users sign in with the **same email and password** already in Cognito (`us-east-1_0z6tA6WBs`, client `3nkemnrffspnaa0ikp2un6koh0`). Production pool MFA stays **required**. Field users enroll TOTP via the in-app QR (same secret as the web console / Google Authenticator). Only App Review accounts (`apple-review@` / `appreviewer@`) auto-complete MFA so ASC can sign in with email + password alone.

## Apple review

Unlisted App Store listing. Bundle `us.rapidcortex.field`. Version **1.0.0**. Increment **build** on every upload (current: **4**). The binary is iPhone-only (`TARGETED_DEVICE_FAMILY = 1`); iPad may still install it in compatibility mode — QR works there, NFC does not.

### Listing (App Store Connect)

| Field | Value |
|---|---|
| Name | NexCort iQ Mobile |
| Subtitle | NFC & QR Code Installer |
| Category | Business |
| Age rating | 4+ |
| Price | Free |
| Availability | **Unlisted App Distribution** (invite / direct link, not searchable) |
| Privacy policy | https://www.rapidcortex.us/privacy |
| Support URL | https://www.rapidcortex.us |
| Support email | support@nexcortiq.us |
| Encryption | Uses only HTTPS / standard iOS crypto (`ITSAppUsesNonExemptEncryption` = false) |
| Nutrition label | Email Address — linked to identity — App Functionality — not used for tracking |

### Description (paste into App Store Connect)

Do **not** claim Face ID, Touch ID, or in-app sign-up. Sign-in is email + password (optional authenticator MFA). iOS Keychain AutoFill may use Face ID; that is the system, not this app.

```
NexCort iQ Mobile is a field tool for campus security teams, venue operations staff, and NexCort iQ administrators. Use it to deploy and manage safety reporting signs at your locations.

WHAT YOU CAN DO

- Generate QR codes for safety reporting signs tied to campus zones or venue sections
- Program NFC tags from this app — no separate NFC writer required
- Manage sign locations and reporting zones for your agency
- Sign in with the NexCort iQ account issued by your agency

FOR CAMPUS AND VENUE STAFF ONLY

This is a staff-facing tool. Accounts are provisioned by your agency administrator during onboarding. There is no in-app sign-up. It is not a consumer app and is not intended for general public use.

Learn more at https://www.rapidcortex.us
```

### Seed the review login (before Submit)

App Store Connect currently uses `appreviewer@rapidcortex.us` as **venue admin** on `test-venue-mbs` so Apple lands on **QR & NFC Codes**, not the 911 console. (Some ASC notes still say `@rapidcortex.ai` — that alias is also on the silent-MFA allowlist; prefer `.us` in Sign-In Information.) Production Cognito MFA stays **ON** for the web console. NexCort iQ Mobile auto-completes TOTP **only** for App Review emails, then calls `/api/auth/app-review/release-mfa` so iPhone and iPad each get a fresh MFA_SETUP (no 6-digit wall). Do not commit the password.

```bash
source scripts/env-api-dev.sh
export RAPID_CORTEX_TEST_TEMP_PASSWORD='…'   # must match the App Store Connect sign-in password
npx tsx scripts/seed-role-test-users.ts
AGENCY_ID=test-venue-mbs AGENCY_NAME="Test Venue MBS" bash scripts/seed-qr-nfc-test-campus.sh
```

Confirm `test-venue-mbs` exists (`bash scripts/seed-vertical-agencies.sh` if needed). Sign in on a physical iPhone with that account before you submit.

### Review notes (paste into App Store Connect)

**Sign-In Information (canonical until we cut over to nexcortiq):**
- User name: `appreviewer@rapidcortex.us`
- Password: the Cognito password already set for that user (do not commit it)

Aliases `appreviewer@nexcortiq.us` / `appreviewer@rapidcortex.ai` exist for silent MFA, but **do not put those in Sign-In Information** unless we intentionally switch domains. Apple previously tried `appviewer@rapidcortex.ai` (typo) — that is not the demo login.

Replace the Notes box with (paste the **unlisted NFC demo video URL** on the DEMO VIDEO line):

```
WHAT THIS APP IS
Staff at campuses and venues use NexCort iQ Mobile to print QR codes and program NFC stickers for safety reporting signs. It is not sold to the public. People get an account from their agency. There is no Sign Up button. To delete an account, email support@nexcortiq.us.

REVIEW ON IPHONE
Please review on a physical iPhone. Core NFC tag writing is not available on iPad (including iPad Air). iPhone-only binary; iPad compatibility mode can sign in and view QR codes. NFC programming requires iPhone 7 or later.

SIGN IN (use the username and password in Sign-In Information above)
Email: appreviewer@rapidcortex.us
This demo account does not require an authenticator code. Enter the password and tap Sign in. You land on QR & NFC Codes.

After Sign in you are already on the Codes tab (large title: QR & NFC Codes). There is no home screen or main menu to tap first.

NFC / DESIGNATED HARDWARE
Designated hardware is a blank NTAG213 (or similar Type 2) NFC sticker — not a Bluetooth accessory. There is no pairing PIN. The app writes an NDEF URI so a visitor can tap the sign. This cannot be demonstrated in Simulator or on iPad.

DEMO VIDEO (physical iPhone + NFC sticker)
https://REPLACE_WITH_UNLISTED_VIDEO_URL

HOW TO TEST
1. Sign in with the demo email and password. No authenticator step.
2. On Codes, tap any location card. You should see the QR image, the URL, Share, and Save to Photos.
3. On iPhone, tap Program NFC Tag. Hold the TOP edge of the iPhone to the sticker until the write succeeds.
4. Tap the Create tab. Enter a name and a zone, then save.
5. Tap Settings. Open Privacy Policy and Terms of Use.

Privacy policy: https://www.rapidcortex.us/privacy
Support: support@nexcortiq.us
```

### NFC demo video (required for Guideline 2.1)

Film on a **physical iPhone** (not Simulator, not iPad). One take, 30–90 seconds, showing the device and the sticker in the same frame:

1. Phone lock screen or home screen so it is clearly a physical iPhone, then open NexCort iQ Mobile.
2. Sign in as `appreviewer@rapidcortex.us` (password only; no authenticator prompt).
3. Codes list → tap **Program NFC Tag**.
4. Hold the **top edge** of the iPhone to a blank NTAG213 until the write succeeds.
5. Optional: NFC Tools / a second phone reading the tag URL is helpful but not required.

Upload unlisted to YouTube or a direct HTTPS MP4. Paste the URL into App Review Information **and** reply to the review message.

### Reply in App Store Connect (after build 3 + video URL)

```
Thank you for the review.

Guideline 2.1 — NFC demo
NexCort iQ Mobile writes an NDEF web URL onto NTAG213 (Type 2) NFC stickers used on campus and venue safety signs. This is not Bluetooth pairing and there is no accessory PIN. Core NFC tag writing is iPhone-only; it is not available on iPad or the Simulator.

Demo video of the current app on a physical iPhone programming an NFC sticker:
https://REPLACE_WITH_UNLISTED_VIDEO_URL

Guideline 2.1(a) — sign-in
Please use exactly these Sign-In Information credentials (not the older .ai address or the mistyped appviewer username):

User name: appreviewer@rapidcortex.us
Password: (the password already entered in Sign-In Information)

Production Cognito still requires authenticator MFA on the web console. NexCort iQ Mobile completes MFA automatically for this demo account only, so Review only enters email and password — no 6-digit authenticator code.

Please review on a physical iPhone. After sign-in the app opens on QR & NFC Codes. We also updated Notes and Sign-In Information in App Review Information.
```

### Still required in App Store Connect (not in git)

1. Create the app record if it does not exist (bundle `us.rapidcortex.field`, SKU e.g. `rc-mobile-ios`).
2. Enable **Near Field Communication Tag Reading** on the App ID; entitlement is `TAG` only — do not add `NDEF`.
3. Archive in Xcode → Distribute App → App Store Connect.
4. Screenshots (iPhone 6.7" required): login, Codes list, code detail with QR, Create, Settings with legal links.
5. Paste the review notes and demo password.
6. Submit for review.

### Unlisted distribution questionnaire (paste into Apple’s form)

**Describe in detail the business problem your app solves and why unlisted app distribution helps solve this problem. Please provide specific examples.**

Campus security and venue operations teams need a way to put a working safety-reporting sign on a door, gate, or concourse: a printed QR code and an NFC sticker that opens the correct NexCort iQ reporting page for that exact location (for example, “Miller Learning Center — Main Entrance” or “Mercedes-Benz Stadium — Gate 3”). Today that work is either done in a browser on a laptop, which is unusable on a ladder with a roll of NTAG213 stickers, or with a consumer NFC utility that is not tied to the agency’s account, locations, or audit trail.

NexCort iQ Mobile solves that field job. An agency-provisioned user signs in, sees only their agency’s codes, generates the QR, and programs the NFC tag from the same iPhone they carry on site.

Unlisted distribution matches how the product is sold. This is not an app a student, fan, or 911 caller should find by searching “NexCort iQ,” “campus safety,” or “NFC.” The people who scan a sign never need this app; only the staff who install the sign do. A public listing would draw the wrong audience (people looking for a consumer emergency app), create support load from users who cannot sign in, and imply NexCort iQ is a public 911 client. A direct link given during customer onboarding reaches installers without putting a staff tool in App Store search.

Specific examples:
- A campus safety manager walks a building, creates a code for each stairwell, prints the QR, and taps Program NFC Tag on an NTAG213 at that door.
- A stadium operations lead programs Gate 3 vs. Gate 12 so a tap opens the right venue reporting flow, not a generic URL.
- NexCort iQ staff program booth signs at a trade show so a tap opens www.rapidcortex.us, not a live incident form.

**Why do you prefer unlisted app distribution over public distribution on the App Store?**

The app is a staff installer for paying NexCort iQ customers. It requires an account issued by the agency; there is no sign-up. Public search would surface it to the general public, who cannot use it and should not try. Public distribution also conflicts with the product story: visitors use the QR/NFC on the wall; staff use this app to put the wall in place. Unlisted keeps the App Store listing off search, “More by this developer,” and browse, while still letting us send one HTTPS link to an onboarded installer.

**Why do you prefer unlisted app distribution over private distribution to specific organizations via Apple Business or Apple School Manager?**

Our customers are many independent organizations (universities, stadiums, and similar agencies), not one enterprise we control in a single Apple Business Manager account. Most of them are not set up to redeem custom apps in ABM/ASM, and many field installers use personally owned iPhones that are not on that organization’s MDM. Access is granted in NexCort iQ (Cognito role + agency), not by adding a DUNS number to our custom-app list. Requiring every campus and venue to complete ABM enrollment before an installer can put up a sign would block onboarding. Unlisted lets us send the same download link during NexCort iQ onboarding; the app still requires username and password, so the link is not a substitute for authentication.

**Will your app be distributed internally to your employees, externally to partners and/or customers, or both?**
- Internally — yes (NexCort iQ employees who install demo/booth signs and support customers)
- Externally — yes (customer campus, venue, and related agency staff)

**How many people will use this app?**
About 50–150 in the first year (a small number of installers per agency, plus NexCort iQ field staff). It will grow only as contracted agencies are onboarded. It is not a mass-market install base.

**How many organizations (for example, businesses or schools) will use this app?**
About 5–25 in the first year (NexCort iQ plus contracted campuses and venues). Each organization is a NexCort iQ customer tenant, not a consumer.

**Who is your app designed for?**
- Full-time employees — yes (campus safety / venue operations)
- Part-time employees — yes (event-day operations staff)
- Third-party contractors — yes (contracted security or signage installers provisioned by the agency)
- Franchise operators — no
- Corporate customers — yes (staff at NexCort iQ customer organizations)
- Faculty, staff, or students — no (students and faculty do not use this app; campus *security staff* are covered as employees)
- General public — no
- Other — no

**What category best describes your app?**
Security

(If the form required a second choice: Partner or contractor operations. Do not choose Point-of-sale, Healthcare, or Productivity as the primary category.)

**Will the app be distributed to managed devices, unmanaged devices, or both?**
- Managed — yes (some agencies issue MDM iPhones)
- Unmanaged — yes (many installers use personally owned iPhones)

**In what regions will your app be available?**
USA only. Do not select all countries. NexCort iQ currently sells and supports this product in the United States. Adding every storefront looks like a public app and can delay or deny unlisted approval.

Acknowledge every checkbox at the bottom (ready for final distribution, not TestFlight, not a security feature, cannot convert back, you have authority). The binary you submit must be the production NexCort iQ Mobile build, not a beta.

## SPM

[BigInt](https://github.com/attaswift/BigInt) is required for Cognito SRP. Xcode resolves it from `project.yml` when you first open the project.

## Spec

Pixel and protocol notes: [`CURSOR_RC_FIELD_IOS.md`](./CURSOR_RC_FIELD_IOS.md) (also copied to the repo root).
