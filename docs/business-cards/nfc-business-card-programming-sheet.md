# Program NFC Business Cards

**Printable sheet:** open [`nfc-business-card-programming-sheet.html`](./nfc-business-card-programming-sheet.html) in a browser → **Print** (Letter, portrait).

## What gets written

Write this URL onto the physical sticker:

`https://www.nexcortiq.us/c/{cardId}`

Do **not** write the public profile URL (`https://www.nexcortiq.us/card/{slug}`). That URL is for QR/share only. Editing the digital card later does not require rewriting the tag.

**Tags:** NTAG213, NTAG215, or NTAG216.

## Console steps

1. Open **NFC Card Management** (Business Cards → NFC).
2. **Add NTAG213** → copy the permanent `/c/…` URL.
3. **Assign to…** the person’s card → **Assign**.

## Write the sticker

### NexCort iQ Mobile (preferred)

1. Sign in as **`rcadmin` or `rcsuperadmin`** (venue/campus staff logins do not get this tool).
   - **Android:** open NC Venue or NC Campus with that RC account → **Business Card NFC**.
   - **iOS:** on agency select, tap **Business Card NFC** (or open Reporting Points after picking an agency).
2. Pick the person’s tag → program the NFC sticker.
3. Hold the phone to the sticker until write succeeds (Android: back of phone; iPhone: top edge).
4. Status is marked **programmed** automatically (no separate web step).

### Chrome on Android (fallback)

1. On the NFC Card Management row, use **Write to tag**.
2. Hold the blank sticker flat on the back of the phone until write succeeds.
3. Confirm status **programmed** (or click **Mark programmed**).

## Verify

1. Tap the sticker with a phone → person’s public card should open.
2. **Mark verified**.
3. Affix sticker (avoid metal laminate over the chip).

## Revoke

Lost/stolen tag: enter a reason → **Revoke**. Profile stays live; tag resolves to `/c/revoked`. Issue a new NTAG; do not reuse revoked ids.

## Store links (field apps)

- Android: https://play.google.com/store/apps/details?id=us.rapidcortex.app
- iOS (unlisted): https://apps.apple.com/us/app/nexcort-iq-mobile/id6811733550
