# Admin guide

Open **Business Cards** in the sidebar after the feature is enabled for your agency.

1. **Card Settings** turns business cards on for this agency only. Company name continues to come from the agency record.
2. **Create Business Card** takes the person’s Cognito user id from **Users** in this same agency, then the display fields. The card stays unpublished until **Activate**.
3. **All Employee Cards** lists cards in this agency. Search matches the loaded page (name, email, department).
4. **NFC Card Management** adds an NTAG record and shows `https://www.nexcortiq.us/c/{cardId}`. Program that URL with the existing QR/NFC tool, then choose **Mark programmed**. Revoke requires a reason. The person’s public profile stays up; the tag starts resolving to `/c/revoked` immediately.
5. **Card Analytics** and **Card Audit** show counts and field names. Audit rows do not store the old or new values.

A setup note appears on the dashboard for administrators while fewer than half of the agency’s cards are active, or while none exist.
