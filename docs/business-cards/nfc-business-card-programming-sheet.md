# Set Up Your NFC Business Card

**Printable:** [`nfc-business-card-programming-sheet.html`](./nfc-business-card-programming-sheet.html) → Print, or [`nfc-business-card-programming-sheet.pdf`](./nfc-business-card-programming-sheet.pdf).

NexCort iQ employees: finish **My Contact Card** on the dashboard first, then write the chip with the **NexCort iQ Mobile** app **or** **Chrome on Android**.

## What gets written?

Your **permanent tap link** — `https://www.nexcortiq.us/c/` plus a short ID  
(example: `https://www.nexcortiq.us/c/abc123`).

A tap opens your public contact page. Do **not** write the share-page link (`https://www.nexcortiq.us/card/yourname`). Editing details later does not require rewriting the chip.

Stickers: **NTAG213** · **NTAG215** · **NTAG216**

---

## Step 1 — Dashboard (My Contact Card)

1. Sign in at https://app.rapidcortex.us, then open **CONTACT CARD → My Contact Card** in the left nav  
   (or go directly to https://app.rapidcortex.us/rc-admin/profile/business-card — sales use https://app.rapidcortex.us/sales/business-card).
2. On the **Create** tab, enter or update name, title, photo, phone, email, and links → **Save Changes**.
3. Click **Publish** so your public page is live (status shows **Published**).
4. Open the **NFC** tab on the same screen. Confirm:
   - **NFC tag** is not **No tag assigned**
   - Your permanent tap link is shown (`nexcortiq.us/c/…`)  
   If it says **No tag assigned**, stop and ask an admin (`rcadmin` / `rcsuperadmin`) to assign a tag in **CONTACT CARD → NFC Card Management** before writing.

---

## Step 2 — Write the chip

Skip if tapping the card already opens your public page.

### Option A — NexCort iQ Mobile

1. Install the app if needed (links at bottom).
2. Sign in with your NexCort iQ work login (`rcsuperadmin`, `rcadmin`, `rcitadmin`, or `salescontractor`).
3. Open **Business Card NFC**:
   - **iPhone:** Settings → **Marketing** → **Business Card NFC**
   - **Android or iPhone (Venue/Campus):** Codes / Reporting Points home → **Business Card NFC**
   - **iPhone (before agency pick):** **Business Card NFC** on the agency select screen
4. Select your assigned card → **Program NFC Tag**.
5. Hold the NFC area to the phone until success (Android: upper-back center; iPhone: top edge). Remove a thick case if needed.
6. When the app confirms, status is marked programmed. Tap any phone to verify. If the write succeeded but status did not update, ask an admin to **Mark programmed** in **NFC Card Management**.

### Option B — Chrome on Android (Web NFC)

1. **Open Chrome on Android only.** Safari, Firefox, and all desktop browsers cannot write NFC. Turn NFC on: **Settings → Connected devices → NFC → On** (wording may vary by phone).
2. Sign in at https://app.rapidcortex.us and open **My Contact Card** (same URLs as Step 1).
3. Open the **NFC** tab → tap **Write to tag**. Chrome asks you to bring the tag close.  
   *(Admins can also write from **CONTACT CARD → NFC Card Management** on a card row — same **Write to tag** button.)*
4. Hold the blank NFC card **flat** against the **upper-back center** of the phone. Hold completely still. **Remove the phone case first** if the write does not start — that is the most common failure.
5. Wait for Chrome to vibrate and show success (usually 1–2 seconds). Do not move the card until you see it. Success text: **Tag written. Tap it with another phone to open the card.**
6. **Tap to verify** with a second phone (any phone). It should open your public profile via the permanent tap link (`nexcortiq.us/c/` + ID). Wrong page? Rewrite using the tap link, not `…/card/yourname`.
7. Admins only: in **NFC Card Management**, status may update automatically after **Write to tag**. If not, click **Mark programmed**, then **Mark verified** after the tap-test passes.

**Chrome note:** Most common failure = phone case blocking the NFC antenna. iPhone Safari cannot write — use the app or borrow an Android.

---

## Checklist

- [ ] My Contact Card: **Save Changes** · **Publish** · **NFC** tab shows tap link (not **No tag assigned**)
- [ ] Wrote chip with app (**Program NFC Tag**) or Chrome (**Write to tag**) — or tap already worked
- [ ] Second-phone tap opens my public page · admin **Mark programmed** / **Mark verified** only if needed

## App links

- Android: https://play.google.com/store/apps/details?id=us.rapidcortex.app
- iOS (unlisted): https://apps.apple.com/us/app/nexcort-iq-mobile/id6811733550
