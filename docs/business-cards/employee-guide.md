# Employee guide

When business cards are on for your agency and you do not have a card yet, the dashboard shows “Set up your digital business card.” Dismiss stores `bizcard-setup` in local storage.

**Business Card** opens three tabs:

- **Edit** saves with `PUT /api/business-cards/me`. Company name, primary email, and website stay locked. A draft is kept in local storage until the save succeeds. If someone else saved first, the page asks you to reload.
- **Publish** makes `/card/{slug}` public.
- **NFC preview** shows the phone frame and the stable profile URL.
- **Share** copies `https://www.nexcortiq.us/card/{slug}` and downloads a 1200px PNG or an SVG. The QR code uses that profile URL, not the NFC tag URL.

After the card is active, **My Digital Card** appears next to Sign out.

The public page shows only fields marked public. **Add to Contacts** downloads a vCard.
