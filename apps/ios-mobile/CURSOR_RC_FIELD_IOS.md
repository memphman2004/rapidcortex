# Rapid Cortex Field — iOS Native App
## Complete Cursor Build Instructions

**Product:** Rapid Cortex Field — NFC & QR Installer  
**Platform:** iOS 16+ · iPhone only · Swift 5.9 · SwiftUI  
**Bundle ID:** `us.rapidcortex.field`  
**Legal entity:** Apps on Demand  
**Backend:** Rapid Cortex API — `https://api.rapidcortex.us`  
**Auth:** AWS Cognito USER_SRP_AUTH  
**Distribution:** App Store (Unlisted) → invite-only via direct link

---

## 1. XCODE PROJECT SETUP

Create a new Xcode project:
- Template: **App**
- Product Name: `RapidCortexField`
- Team: Apps on Demand
- Organization Identifier: `us.rapidcortex`
- Bundle Identifier: `us.rapidcortex.field`
- Interface: SwiftUI
- Language: Swift
- Minimum Deployments: **iOS 16.0**
- Deselect iPad — iPhone only

### 1.1 Required Capabilities
In Target → Signing & Capabilities, add:
- **Near Field Communication Tag Reading**

This generates `RapidCortexField.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.nfc.readersession.formats</key>
  <array>
    <string>NDEF</string>
  </array>
</dict>
</plist>
```

### 1.2 Info.plist Keys
```xml
<key>NFCReaderUsageDescription</key>
<string>Rapid Cortex Field uses NFC to program safety reporting tags at your agency's locations.</string>

<key>RC_COGNITO_USER_POOL_ID</key>
<string>$(RC_COGNITO_USER_POOL_ID)</string>

<key>RC_COGNITO_CLIENT_ID</key>
<string>$(RC_COGNITO_CLIENT_ID)</string>

<key>UIRequiredDeviceCapabilities</key>
<array>
  <string>nfc</string>
</array>

<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

### 1.3 Config.xcconfig (never commit)
```
RC_COGNITO_USER_POOL_ID = us-east-1_XXXXXXXXX
RC_COGNITO_CLIENT_ID    = xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 1.4 Swift Package Dependencies
Add via File → Add Package Dependencies:
- `https://github.com/attaswift/BigInt` — for Cognito SRP bignum math

### 1.5 Assets.xcassets
- Add `AppIcon` — use RapidCortex_Logo.PNG (provided, 1080×1080)
  Generate all required sizes with Asset Catalog
- Add color set `RCBlue` = #1A3ACC
- Add color set `RCAccent` = #3B6EFF
- Add color set `RCRed` = #CC1F25
- Add color set `RCBackground` = #0A0C12

---

## 2. PROJECT FILE STRUCTURE

```
RapidCortexField/
├── App/
│   ├── RapidCortexFieldApp.swift      ← entry point, tab shell
│   ├── Config.xcconfig                ← secrets (gitignored)
│   └── RapidCortexField.entitlements
│
├── Auth/
│   ├── CognitoAuthManager.swift       ← SRP auth, token refresh
│   ├── CognitoSRPHelper.swift         ← BigInt SRP implementation
│   ├── KeychainManager.swift          ← secure token storage
│   ├── LoginView.swift                ← sign in screen
│   └── MFAView.swift                  ← TOTP challenge screen
│
├── API/
│   ├── RCAPIClient.swift              ← authenticated HTTP client
│   └── Models/
│       ├── QRNFCCode.swift            ← QR/NFC code model
│       ├── Agency.swift               ← agency model
│       └── QRLocation.swift           ← location model (RCLI)
│
├── NFC/
│   ├── NFCTagWriter.swift             ← Core NFC session + write
│   └── NFCWriterView.swift            ← write UI with state machine
│
├── QR/
│   ├── QRCodeGenerator.swift          ← CoreImage QR generation
│   └── QRCodeView.swift               ← inline QR preview component
│
├── Codes/
│   ├── CodesListView.swift            ← grouped code browser
│   ├── CodesListViewModel.swift       ← fetch + grouping logic
│   ├── CodeDetailView.swift           ← detail + actions
│   └── NewCodeView.swift              ← create wizard
│
├── Agencies/
│   ├── AgenciesView.swift             ← agency switcher (RC admins)
│   └── AgenciesViewModel.swift
│
├── Settings/
│   └── SettingsView.swift             ← account info, sign out
│
└── Shared/
    ├── RCTheme.swift                  ← design tokens
    ├── RCComponents.swift             ← reusable UI components
    └── Extensions.swift               ← Color+hex, View helpers
```

---

## 3. BRAND & DESIGN SYSTEM

The app uses a dark command-center aesthetic matching
the Rapid Cortex web dashboard. Always dark — no light mode.

### 3.1 Logo
The Rapid Cortex logo (provided as `RapidCortex_Logo.PNG`) shows:
- Left half: blue brain with circuit board — represents AI intelligence
- Right half: red radar/signal rings — represents communications
- Text: "RAPID" in navy, "CORTEX" in red, tagline below

Use as the app icon (all sizes). In the login screen, render
a simplified version: an 80×80 rounded rectangle in `#1A3ACC`
containing the letters "RC" in white, weight .black, SF Pro Rounded.

### 3.2 Color Tokens (implement in RCTheme.swift)

```swift
enum RCTheme {
  // Brand — from logo
  static let logoBlue     = Color(hex: "#1B3FA0")  // left brain blue
  static let logoRed      = Color(hex: "#CC1F25")  // right radar red

  // Primary action
  static let accent       = Color(hex: "#1A3ACC")
  static let accentLight  = Color(hex: "#3B6EFF")

  // Status
  static let success      = Color(hex: "#2ECC71")  // NFC written / active
  static let warning      = Color(hex: "#F39C12")  // pending
  static let danger       = Color(hex: "#E74C3C")  // error / 911

  // Surfaces (dark hierarchy)
  static let bg           = Color(hex: "#0A0C12")  // app background
  static let surface1     = Color(hex: "#12151F")  // card
  static let surface2     = Color(hex: "#0D1020")  // inset
  static let surface3     = Color(hex: "#080A14")  // deep inset
  static let border       = Color(hex: "#1E2235")  // hairline
  static let borderStrong = Color(hex: "#2A2D3A")  // emphasized

  // Text
  static let textPrimary   = Color(hex: "#E8EAFF")
  static let textSecondary = Color(hex: "#A0A8C0")
  static let textMuted     = Color(hex: "#4A5070")

  // Vertical badge colors
  static func verticalColors(_ v: String) -> (bg: Color, fg: Color) {
    switch v.lowercased() {
    case "campus": return (Color(hex: "#0A2A1A"), Color(hex: "#2ECC71"))
    case "venue":  return (Color(hex: "#0A1A3A"), Color(hex: "#3B6EFF"))
    case "911":    return (Color(hex: "#2A0808"), Color(hex: "#E74C3C"))
    default:       return (Color(hex: "#1A1A2A"), Color(hex: "#A0A8C0"))
    }
  }
}
```

### 3.3 Typography
- All system fonts: SF Pro (automatic on iOS)
- Never override font to non-system
- Sizes: 28 (hero), 20 (title), 17 (body), 15 (action), 13 (meta), 11 (label), 10 (badge)
- Weights: .black (logo/hero only), .bold, .semibold, .medium, .regular
- Monospaced: `.monospacedDigit()` for counts, `.monospaced()` for URLs and IDs

### 3.4 Corner Radius
- Cards: 12px
- Buttons: 12px
- Small badges: 4–6px
- Input fields: 10px

### 3.5 Spacing
- Screen horizontal padding: 16px
- Card internal padding: 14px
- Section gap: 12px
- Component gap: 8px

---

## 4. DATA MODELS

### 4.1 QRNFCCode (matches DynamoDB schema)
```swift
struct QRNFCCode: Identifiable, Codable, Equatable {
  var id: String { qrId }
  let qrId:           String   // ULID, e.g. "01J3KX8ABCDEF..."
  let agencyId:       String   // e.g. "test-campus-uga"
  let agencyName:     String
  let name:           String   // "Miller Learning — Main Entrance"
  let vertical:       String   // "campus" | "venue" | "911"
  let reportType:     String   // "anonymous" | "identified" | "both"
  var nfcEnabled:     Bool
  var active:         Bool
  let url:            String   // "https://app.rapidcortex.us/report/{qrId}"
  var scanCount:      Int
  var nfcTapCount:    Int
  var totalEngagements: Int
  let createdBy:      String
  let createdByRole:  String
  let createdAt:      String   // ISO 8601
  var updatedAt:      String
  // Location fields (optional, from qr-locations join)
  var locationName:   String?
  var building:       String?
  var floor:          String?
  var zone:           String?
  var zoneCode:       String?  // e.g. "UGA101"
}
```

### 4.2 QRLocation (RCLI location model)
```swift
struct QRLocation: Identifiable, Codable {
  var id: String { rcli }
  let rcli:         String   // e.g. "RC-UGA-0001"
  let agencyId:     String
  let orgCode:      String   // e.g. "UGA"
  let vertical:     String
  let locationName: String
  let building:     String?
  let floor:        String?
  let zone:         String?
  let zoneCode:     String?
  var active:       Bool
  var scanCount:    Int
}
```

### 4.3 Agency
```swift
struct Agency: Identifiable, Codable {
  var id: String { agencyId }
  let agencyId:  String   // e.g. "columbus-state"
  let name:      String
  var vertical:  String
  var active:    Bool
  var codeCount: Int?
  var planTier:  String?  // "essential" | "command" | "enterprise"
}
```

### 4.4 User Roles
These match `custom:role` in Cognito ID token exactly:
```
rcsuperadmin  — full platform access, all agencies
rcadmin       — ops access, all agencies
rcitadmin     — IT/support access, all agencies
agencyadmin   — full access to own agency
agencyit      — IT access to own agency
campus_admin  — campus vertical admin
venue_admin   — venue vertical admin
```
Only roles that `canManageCodes` should access RC Field:
```swift
var canManageCodes: Bool {
  ["rcsuperadmin","rcadmin","rcitadmin",
   "agencyadmin","agencyit","campus_admin","venue_admin"]
   .contains(role)
}
```

### 4.5 NewQRNFCCodeRequest
```swift
struct NewQRNFCCodeRequest: Encodable {
  let name:       String
  let vertical:   String
  let reportType: String
  let nfcEnabled: Bool
  let building:   String?
  let floor:      String?
  let zone:       String?
  let zoneCode:   String?
}
```

---

## 5. AUTHENTICATION (CognitoAuthManager.swift)

### 5.1 Cognito Configuration
Read from Info.plist (injected via xcconfig):
```swift
let userPoolId = Bundle.main.object(forInfoDictionaryKey: "RC_COGNITO_USER_POOL_ID") as? String ?? ""
let clientId   = Bundle.main.object(forInfoDictionaryKey: "RC_COGNITO_CLIENT_ID")    as? String ?? ""
let region     = "us-east-1"
let baseURL    = "https://cognito-idp.us-east-1.amazonaws.com/"
```

### 5.2 Auth Flow
Use `USER_SRP_AUTH`. The flow:

1. `InitiateAuth` with `AuthFlow: USER_SRP_AUTH`, `USERNAME`, `SRP_A`
2. Receive `PASSWORD_VERIFIER` challenge with `SECRET_BLOCK`, `SRP_B`, `SALT`
3. `RespondToAuthChallenge` with `PASSWORD_VERIFIER` + SRP proof
4. If `SOFTWARE_TOKEN_MFA` challenge → prompt TOTP → `RespondToAuthChallenge`
5. Receive `AuthenticationResult` with `AccessToken`, `IdToken`, `RefreshToken`

### 5.3 SRP Implementation (CognitoSRPHelper.swift)
Use the `BigInt` package (attaswift/BigInt).

Reference the official Cognito SRP spec. Key constants:
- N: 3072-bit prime (see AWS Cognito documentation)
- g: 2
- k: `H(N || g)` (pad N and g to same length)
- Pool name: the part after `us-east-1_` in the user pool ID

The signature computation:
1. `x = H(salt || H(poolName || ":" || username || ":" || password))`
2. `u = H(A || B)` where A and B are the ephemeral keys
3. `S = (B - k * g^x)^(a + u*x) mod N`
4. `K = H(S)`
5. `M = H(H(N) XOR H(g) || H(poolName) || H(username) || salt || A || B || K)`
6. Sign with HMAC-SHA256: key = K, data = poolName + username + secretBlock + timestamp

### 5.4 Token Storage (KeychainManager.swift)
Store all tokens in Keychain:
- `kSecAttrAccessible`: `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
- Keys: `rc_access_token`, `rc_id_token`, `rc_refresh_token`
- Never store in UserDefaults

### 5.5 Token Refresh
On app foreground and before any API call:
- Check if `accessToken` expires within 60 seconds
- If so, call `InitiateAuth` with `REFRESH_TOKEN_AUTH` + refresh token
- On refresh failure, sign out and redirect to login

### 5.6 JWT Claims Decoding
Decode the ID token (base64url, middle segment) to extract:
```swift
struct RCUserClaims {
  let email:    String  // "email"
  let role:     String  // "custom:role"
  let agencyId: String  // "custom:agencyId"
  let sub:      String  // "sub"
}
```

### 5.7 Published State
```swift
@MainActor
final class CognitoAuthManager: ObservableObject {
  @Published private(set) var isAuthenticated = false
  @Published private(set) var claims: RCUserClaims?
  @Published private(set) var isLoading = false
  @Published var error: String?
  @Published var requiresMFA = false
  @Published var mfaCode = ""
}
```

---

## 6. API CLIENT (RCAPIClient.swift)

### 6.1 Base Configuration
```
Base URL:    https://api.rapidcortex.us
Auth header: Authorization: Bearer {accessToken}
User-Agent:  RCField-iOS/1.0
Timeout:     15 seconds
Content-Type: application/json
```

### 6.2 Endpoints

**List codes for agency:**
```
GET /agencies/{agencyId}/qr-codes
Response: { items: QRNFCCode[], count: Int, nextToken?: String }
```

**Create new code:**
```
POST /agencies/{agencyId}/qr-codes
Body: NewQRNFCCodeRequest
Response: { item: QRNFCCode }
```

**Record NFC write (audit trail — call after every successful write):**
```
POST /agencies/{agencyId}/qr-codes/{qrId}/nfc-write
Body: { deviceModel: String, platform: "ios" }
Response: { success: Bool }
```

**Deactivate code:**
```
DELETE /agencies/{agencyId}/qr-codes/{qrId}
Response: { success: Bool }
```

**List agencies (platform admins only):**
```
GET /agencies
Response: { items: Agency[], count: Int }
```

**Get single agency:**
```
GET /agencies/{agencyId}
Response: Agency
```

### 6.3 Error Handling
Map HTTP status codes to typed errors:
```swift
enum RCAPIError: LocalizedError {
  case invalidURL(String)
  case networkError
  case unauthorized     // 401 — trigger re-auth
  case forbidden        // 403
  case notFound         // 404
  case rateLimited      // 429
  case serverError(Int, String?)
}
```
On 401, call `CognitoAuthManager.shared.signOut()` and show login.

### 6.4 JSON Decoding
Use `keyDecodingStrategy: .convertFromSnakeCase` so API's
`snake_case` maps to Swift `camelCase` automatically.

---

## 7. NFC TAG WRITING (NFCTagWriter.swift)

### 7.1 Overview
Uses `NFCNDEFReaderSession` (Core NFC). The session writes a
URI NDEF record to NTAG213 stickers. NTAG213 has 137 bytes
of user memory — a Rapid Cortex URL uses ~42 bytes.

### 7.2 Write State Machine
```swift
enum WriteState: Equatable {
  case idle
  case scanning           // session open, waiting for tag
  case writing            // tag connected, writing in progress
  case success(bytesWritten: Int)
  case failure(String)
}
```

### 7.3 Session Configuration
```swift
session = NFCNDEFReaderSession(
  delegate: self,
  queue: .main,
  invalidateAfterFirstRead: false  // false allows writing
)
session?.alertMessage = batchMode
  ? "Hold to each NTAG213 sticker. Session stays open."
  : "Hold the back of your iPhone near the NTAG213 sticker."
session?.begin()
```

### 7.4 Tag Detection and Write
In `readerSession(_:didDetect:)`:
1. Connect to tag: `session.connect(to: tag) { ... }`
2. Query NDEF status: `tag.queryNDEFStatus { status, capacity, error in ... }`
3. If `readWrite`: call write function
4. If `readOnly`: invalidate with error message
5. If `notSupported`: invalidate with "Use NTAG213 stickers"

Write the URL:
```swift
let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: url)!
let message = NFCNDEFMessage(records: [payload])
try await tag.writeNDEF(message)
```

### 7.5 Batch Mode
If `batchMode = true`:
- After successful write, call `session.restartPolling()`
- Update `session.alertMessage` to "✓ Tag N written. Hold to next tag."
- Increment `tagsWritten` counter
- Session stays open until user taps "Done" or "Cancel"

### 7.6 Post-Write Audit
After every successful write, call:
```swift
RCAPIClient.shared.recordNFCWrite(
  agencyId: agencyId,
  qrId: code.qrId,
  deviceModel: UIDevice.current.model
)
```
Do this async — don't block the NFC session or UI on it.

---

## 8. QR CODE GENERATION (QRCodeGenerator.swift)

### 8.1 Generation
Use `CoreImage` — no third-party dependency:
```swift
let filter = CIFilter.qrCodeGenerator()
filter.message = url.absoluteString.data(using: .utf8)!
filter.correctionLevel = "M"   // 15% error correction
```

Scale up from native module grid to 1024×1024 with 4-module
quiet zone enforced on all sides (ISO 18004 minimum).

Output: `UIImage` at 1024×1024 px = print-ready at 300 DPI
(~3.4 inches — correct for most wall signage).

Use `.interpolation(.none)` when displaying in SwiftUI to
prevent blurring of the pixel grid.

### 8.2 Export
- PNG data: `uiImage.pngData()`
- Filename: `rc-qr-{sanitized-location-name}-{qrId[0..<8]}.png`
- Share via `UIActivityViewController` wrapped in `ShareSheet: UIViewControllerRepresentable`
- Save to Photos: `UIImageWriteToSavedPhotosAlbum`

---

## 9. SCREENS — COMPLETE SPECIFICATION

### 9.1 Login Screen (LoginView.swift)
Dark background `#0A0C12`. Vertically centered.

Elements (top to bottom):
- RC logo mark: 64×64 rounded rect `#1A3ACC`, "RC" white .black weight
- "Rapid Cortex" 20pt .semibold `#E8EAFF`
- "Field Installer" 13pt `#4A5070`
- 36px spacer
- Email field with label "EMAIL", placeholder "admin@agency.us"
- Password field with label "PASSWORD" (SecureField)
- Error text in `#E74C3C` if `auth.error != nil`
- "Sign in" button — full width, 48px tall, `#1A3ACC` background, white text
  - Shows ProgressView when `auth.isLoading`
  - Disabled when fields empty or loading
- MFA notice card: shield icon + "MFA via Authenticator required for admin accounts"
  - Background `#12151F`, border `#1E2235`

On `.submitLabel(.go)` of password field, trigger sign in.

### 9.2 MFA Screen (MFAView.swift)
Presented as `.sheet` when `auth.requiresMFA = true`.

Elements:
- `lock.shield.fill` SF Symbol at 40pt in `#3B6EFF`
- "Two-factor authentication" 18pt .semibold
- Instruction text
- 6-digit monospaced TextField, `.keyboardType(.numberPad)`, `.textContentType(.oneTimeCode)`
- Auto-submit when 6 digits entered (onChange)
- "Verify" button

### 9.3 Code List Screen (CodesListView.swift)
Navigation title: "Codes". Large title display.
Subtitle in nav: "{agencyName} · {count} active" (custom UINavigationBar appearance
or displayed under the title as a secondary text).

Content: `List` with `.insetGrouped` style, `.scrollContentBackground(.hidden)`.

Grouped by `zone` alphabetically. Each section header: zone name 11pt .semibold
uppercase muted.

Each row (CodeRowView):
- 8pt colored circle: green `#2ECC71` if nfcEnabled, amber `#F39C12` if not
- Code name 14pt .medium `#E8EAFF`
- Report type + engagement count 11pt muted
- Vertical badge
- Chevron right

Toolbar: "+" button `#3B6EFF` opens NewCodeView as sheet.
Pull-to-refresh: refreshable.
Empty state: QR code SF Symbol + "No codes yet" + instruction.

Tapping a row navigates to CodeDetailView via `navigationDestination`.

### 9.4 Code Detail Screen (CodeDetailView.swift)
Nav title: code name (inline display mode).

Top section — QR Preview:
- White 12px rounded rect, 160×160pt
- QR code rendered via QRCodeGenerator, `.interpolation(.none)`
- Centered, 16pt top padding

Below preview:
- Code name 17pt .semibold centered
- Zone · ZoneCode 12pt muted centered
- Vertical badge centered

URL pill (full width, 16px margins):
- Monospaced URL truncated middle
- Copy button (right-aligned) — copies to clipboard, shows checkmark 1.5s

Action buttons row (2 columns, equal width):
- "Write NFC" — `wave.3.right` icon, bg `#1A2A50`, fg `#5B8AFF`
- "Export QR" — `arrow.down.circle` icon, bg `#0A2A1A`, fg `#2ECC71`

Stats row (3 equal cards):
- QR Scans / NFC Taps / Total
- Each: surface card, 20pt .semibold value, 10pt muted label

Settings card:
- "Batch NFC mode" toggle with description — when ON, NFC session
  stays open for multiple tag writes

Write NFC → presents NFCWriterView as sheet.
Export QR → generates PNG, presents ShareSheet.

### 9.5 NFC Writer Screen (NFCWriterView.swift)
Presented as `.sheet` from CodeDetailView.

Shows the NFCTagWriter state machine visually.

**Scanning state:**
- 3 concentric pulsing rings in `#3B6EFF` at 0.3 opacity
  Pulse animation: scale 0.9→1.0, opacity 0.5→1.0, 1.4s repeat, offset delays
- `wave.3.right` SF Symbol 30pt `#3B6EFF` centered in rings
- "Hold to NFC tag" 17pt .semibold
- "Bring the back of your iPhone near the NTAG213 sticker on the sign." muted
- "Cancel" button

**Writing state:**
- `ProgressView` circular, scaled 1.5×, tinted `#3B6EFF`
- "Writing…" 17pt .semibold
- "Keep tag in contact until complete." muted
- No cancel during write

**Success state:**
- 80pt circle `#0A2A1A` with `checkmark` SF Symbol 32pt `#2ECC71`
- "Tag written" 20pt .bold
- "{N} bytes · NTAG213 programmed." muted
- If batch mode: "Ready for next tag" in `#3B6EFF`
- Buttons: "Write another tag" (accent) + "Done" (surface)

**Failure state:**
- 80pt circle `#2A0808` with `xmark` SF Symbol 32pt `#E74C3C`
- "Write failed" 20pt .bold
- Error message muted, centered
- "Try again" (accent) + "Cancel" (surface)

Batch tag counter shown when tagsWritten > 0:
`checkmark.circle.fill` green + "{N} tag(s) written this session"

URL displayed at bottom in monospaced muted.

On appear: call `writer.beginWriting(url:batch:completion:)`.

### 9.6 New Code Wizard (NewCodeView.swift)
Presented as `.sheet`.

Nav: "Cancel" (leading, muted) | "New Code" (title) | "Save" (trailing, accent)
Save disabled until name field non-empty.

Sections in List `.insetGrouped`:

**Location** section:
- Name * (required) — placeholder "e.g. Miller Learning — Main Entrance"
- Building — optional
- Floor — optional
- Zone — optional, e.g. "Academic Core"
- Zone code — optional, e.g. "UGA101"

**Vertical** section:
- Segmented picker: Campus | Venue | 911
- Default: Campus

**Report type** section:
- Segmented picker: Both | Anonymous | Identified
- Default: Both

**NFC** section:
- Toggle "Enable NFC" — default ON
- If ON: Toggle "Write NFC tag after save" — default ON, opens NFCWriterView on save

On save:
1. POST to API
2. If `writeNFCAfterSave` AND `nfcEnabled`: dismiss sheet, present NFCWriterView
3. Otherwise: dismiss

### 9.7 Agencies Screen (AgenciesView.swift)
Only shown to platform admins (`isPlatformAdmin`).
For agency-scoped admins, this tab shows only their agency info.

Content: List of Agency cards showing:
- Agency name
- Vertical badge
- Code count
- Plan tier

Tapping an agency sets it as the active agency for the session,
reloads CodesListView with that agency's codes.

### 9.8 Settings Screen (SettingsView.swift)
Sections:

**Account:**
- Email (from claims, read-only)
- Role badge
- Agency ID

**App:**
- Version and build number
- Environment (Production)

**Support:**
- "Contact Support" → opens `mailto:support@rapidcortex.us`
- "Visit rapidcortex.us" → opens Safari

**Session:**
- "Sign Out" button — red, confirms before signing out

---

## 10. REUSABLE COMPONENTS (RCComponents.swift)

### RCTextField
```swift
struct RCTextField: View {
  // label: uppercase 11pt muted
  // field: 44px tall, surface2 background, border hairline
  // Supports secure, keyboard type, content type
}
```

### VerticalBadge
```swift
struct VerticalBadge: View {
  let vertical: String
  // Uses RCTheme.verticalColors(vertical)
  // 10pt semibold uppercase, horizontal pill
}
```

### ActionButton
```swift
struct ActionButton: View {
  let title: String
  let systemImage: String
  let background: Color
  let foreground: Color
  let action: () -> Void
  // Vertical stack: icon (20pt) + label (12pt semibold)
  // Full width, 72px tall, 12px corner radius
}
```

### StatCard
```swift
struct StatCard: View {
  let value: Int
  let label: String
  // surface card, 20pt semibold value, 10pt muted label
  // Equal width in HStack
}
```

### ShareSheet
```swift
struct ShareSheet: UIViewControllerRepresentable {
  let items: [Any]
  // Wraps UIActivityViewController
}
```

### RCCard modifier
```swift
struct RCCard: ViewModifier {
  // background: surface1
  // cornerRadius: 12
  // border: 0.5px border color
}
extension View {
  func rcCard() -> some View { modifier(RCCard()) }
}
```

---

## 11. ANIMATIONS

### NFC Scanning Rings
Three concentric circles, each with staggered pulse animation:
```swift
ForEach(0..<3) { i in
  Circle()
    .stroke(RCTheme.accentLight.opacity(0.3 - Double(i) * 0.08),
            lineWidth: 1.5)
    .frame(width: CGFloat(80 + i * 28),
           height: CGFloat(80 + i * 28))
    .scaleEffect(isScanning ? 1 : 0.7)
    .animation(
      .easeInOut(duration: 1.4)
        .repeatForever(autoreverses: true)
        .delay(Double(i) * 0.2),
      value: isScanning
    )
}
```

### Success checkmark
`.transition(.scale.combined(with: .opacity))` on the success circle.

### State transitions
`.animation(.easeInOut(duration: 0.3), value: writer.state)` on the
state machine container.

---

## 12. NAVIGATION ARCHITECTURE

```
TabView
├── CodesListView (NavigationStack)
│   ├── CodeDetailView
│   │   └── NFCWriterView (sheet)
│   └── NewCodeView (sheet)
├── AgenciesView (NavigationStack)
└── SettingsView (NavigationStack)
```

Tab icons (SF Symbols):
- Codes: `qrcode`
- Agencies: `building.2`
- Settings: `gear`

Use `navigationDestination(item:)` for code detail — pass
`QRNFCCode?` as the selection binding.

---

## 13. DARK MODE AND APPEARANCE

Force dark mode at the scene level:
```swift
.preferredColorScheme(.dark)
```

Tab bar appearance:
```swift
let appearance = UITabBarAppearance()
appearance.configureWithOpaqueBackground()
appearance.backgroundColor = UIColor(Color(hex: "#0A0C12"))
UITabBar.appearance().standardAppearance = appearance
UITabBar.appearance().scrollEdgeAppearance = appearance
```

Navigation bar appearance:
```swift
let navAppearance = UINavigationBarAppearance()
navAppearance.configureWithOpaqueBackground()
navAppearance.backgroundColor = UIColor(Color(hex: "#0A0C12"))
navAppearance.titleTextAttributes = [.foregroundColor: UIColor(Color(hex: "#E8EAFF"))]
navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(Color(hex: "#E8EAFF"))]
UINavigationBar.appearance().standardAppearance = navAppearance
UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
UINavigationBar.appearance().compactAppearance = navAppearance
```

Set these in `RapidCortexFieldApp.init()`.

List row backgrounds: `.listRowBackground(RCTheme.surface1)`
List background: `.scrollContentBackground(.hidden)` + ZStack with `RCTheme.bg`

---

## 14. ERROR HANDLING AND EDGE CASES

- **No network:** Show banner "No internet connection" — use
  `NWPathMonitor` to detect connectivity state
- **401 from API:** Auto sign out, show login screen
- **NFC hardware unavailable:** Check `NFCNDEFReaderSession.readingAvailable`
  before showing Write NFC button. Show disabled state with
  "NFC requires iPhone 7 or later" if unavailable.
- **NTAG215/216:** These write fine — only NTAG213 is recommended
  in installation docs, but the writer handles any NDEF-writable tag
- **URL too long for tag:** Check payload bytes against `capacity`
  parameter from `queryNDEFStatus` before writing
- **Empty code list:** Show empty state view with + CTA
- **Role without access:** If `claims.canManageCodes == false`,
  show an access denied screen after login with contact info
- **MFA timeout:** Cognito session tokens expire — on 400 from
  MFA challenge, show "Session expired, sign in again"

---

## 15. ACCESSIBILITY

- All SF Symbols: `aria-label` equivalent via `.accessibilityLabel()`
- Status circles: `.accessibilityLabel("NFC enabled")` or "NFC pending"
- QR code image: `.accessibilityLabel("QR code for \(code.name)")`
- Action buttons: full label including action ("Write NFC tag for \(code.name)")
- Dynamic Type: use `@ScaledMetric` for icon sizes where appropriate
- VoiceOver ordering: set `.accessibilitySortPriority` on action buttons
- Minimum touch targets: all tappable elements minimum 44×44pt

---

## 16. SECURITY REQUIREMENTS

- Tokens stored in Keychain only — never UserDefaults, never logs
- Keychain attribute: `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
  (device-only, survives reboot, CJIS-appropriate)
- No logging of tokens, passwords, or user PII to console
- Certificate pinning: implement for production using
  `URLSession` delegate + `SecTrustEvaluate` against
  api.rapidcortex.us certificate fingerprint
- Jailbreak detection: check for presence of Cydia or unusual
  file paths — log and warn but do not block (agency policy decision)
- Screenshot prevention on sensitive screens: not required
  (no PII displayed beyond email and agency name)

---

## 17. TESTING

### Unit Tests (RapidCortexFieldTests)
- `QRCodeGeneratorTests`: verify PNG output dimensions, non-nil for valid URL
- `NFCTagWriterTests`: verify state transitions (mock NFCNDEFReaderSession)
- `JWTDecoderTests`: verify claims extraction from sample tokens
- `KeychainManagerTests`: save/load/delete round trip

### UI Tests (RapidCortexFieldUITests)
- Login flow with valid credentials → arrives at Codes tab
- Login flow with invalid credentials → shows error
- Code list loads and shows rows
- New code form validation → Save disabled when name empty
- Settings → Sign Out

---

## 18. APP STORE CONFIGURATION

### Version and Build
- Version: `1.0.0`
- Build: `1` (increment on every upload)

### App Store Metadata
- Name: `Rapid Cortex Field`
- Subtitle: `NFC & QR Code Installer`
- Category: Business
- Age Rating: 4+
- Price: Free

### Privacy Nutrition Label
Data collected: Email Address (authentication only), linked to identity.
Nothing else.

### App Review Account
Create in Cognito before submission:
- Email: `apple-review@rapidcortex.us`
- Role: `agencyadmin`
- MFA: disabled for this account only
- Agency: seeded with 3–5 test codes across multiple zones

### App Review Notes
```
B2B tool for Rapid Cortex platform administrators.
Accounts are provisioned during onboarding — no self-registration.

DEMO ACCOUNT:
Email:    apple-review@rapidcortex.us
Password: [set before submission]
MFA:      Disabled

TEST STEPS:
1. Sign in
2. Tap a code to view QR and stats
3. Tap Export QR → share sheet
4. Tap Write NFC → NFC session launches (hold to NTAG213 sticker)
5. Tap + → create a new code

NFC: Uses NDEF writing to program NTAG213 safety reporting stickers.
```

---

## 19. EXISTING SWIFT SOURCE FILES

The following files have already been written and should be
used as the starting point. Copy them into the project as-is,
then extend with any missing views or logic.

Provided files (in `RCField/` directory):
```
App/RapidCortexFieldApp.swift     — entry point and tab shell
Auth/CognitoAuthManager.swift     — auth manager (SRP stubs present)
Auth/KeychainManager.swift        — Keychain + SRP helper stubs
Auth/LoginView.swift              — complete login + MFA UI
API/RCAPIClient.swift             — complete API client
API/Models.swift                  — all data models
NFC/NFCTagWriter.swift            — complete Core NFC writer
NFC/NFCWriterView.swift           — complete write UI
QR/QRCodeGenerator.swift          — complete QR generation
Codes/CodesListView.swift         — complete list with grouping
Codes/CodeDetailView.swift        — complete detail + actions
Codes/NewCodeView.swift           — complete creation wizard
Shared/RCTheme.swift              — complete design tokens
```

Missing files to create fresh (not yet written):
```
Auth/CognitoSRPHelper.swift       — complete BigInt SRP math
Auth/MFAView.swift                — already in LoginView.swift, extract
Agencies/AgenciesView.swift       — new
Agencies/AgenciesViewModel.swift  — new
Settings/SettingsView.swift       — new
Shared/RCComponents.swift         — extract from existing views
Shared/Extensions.swift           — Color+hex (in RCTheme), add others
```

### Critical: Complete the SRP Implementation
`CognitoSRPHelper` in `KeychainManager.swift` has stubbed
bignum math. Complete it using `BigInt` (attaswift/BigInt):

```swift
import BigInt

// In CognitoSRPHelper:
// smallA: random 256-bit number
// bigA = g.power(smallA, modulus: N)
// srpA = bigA.serialize().map { String(format: "%02x", $0) }.joined()
```

Reference: https://github.com/aws-amplify/amplify-js/blob/main/packages/auth/src/providers/cognito/utils/srp/helpers/

Alternatively, if the Cognito user pool client has
`ALLOW_USER_PASSWORD_AUTH` enabled, use USER_PASSWORD_AUTH
(simpler, acceptable for this admin-only app):
```swift
"AuthFlow": "USER_PASSWORD_AUTH",
"AuthParameters": {
  "USERNAME": email,
  "PASSWORD": password
}
```
Check with the RC backend team which auth flow is enabled.

---

## 20. CHECKLIST BEFORE FIRST BUILD

- [ ] Xcode project created with correct bundle ID
- [ ] All existing Swift files copied into project
- [ ] BigInt SPM package added
- [ ] SRP implementation completed (or USER_PASSWORD_AUTH fallback)
- [ ] xcconfig created with Cognito values from AWS stack outputs
- [ ] Info.plist NFC usage description added
- [ ] NFC capability entitlement added
- [ ] App icon added (RapidCortex_Logo.PNG, all sizes)
- [ ] AgenciesView, SettingsView stubs created
- [ ] App compiles without errors on iOS 16 target
- [ ] Test on physical iPhone (NFC does not work in simulator)
- [ ] Login with test Cognito account succeeds
- [ ] QR code generates and exports correctly
- [ ] NFC write session launches and writes to NTAG213

---

*Rapid Cortex — Intelligence at the speed of response*  
*Apps on Demand | support@rapidcortex.us*
