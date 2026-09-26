# Incident media SMS (AWS End User Messaging)

## Deployment checklist

### AWS End User Messaging SMS

- Confirm the account and target region are out of the SMS sandbox before production traffic.
- Complete 10DLC brand + campaign registration and request origination numbers in the AWS SMS console for the deployment region. See `docs/deployment-infrastructure/aws-sms-backup-setup.md`.
- Configure origination identity, default SMS type, spend limits, opt-out behavior, and a configuration set for delivery events.
- In lower environments, set `AWS_SMS_USE_SIMULATOR=true` (or `SMS_PROVIDER=mock`) so Lambdas do not require live SMS delivery.
- Exercise a real send in staging with a verified destination number before promoting.
- Review CloudWatch metrics and End User Messaging delivery events; align alarms with `IncidentMediaHttpErrorsAlarm` / `PublicIncidentMediaHttpErrorsAlarm`.

### Sending number

- **NexCort iQ sending number (outbound-only sender):** production identity **`+1 (470) 748-2763`** (E.164: **`+14707482763`**), a US local **10DLC** number on AWS End User Messaging. Dispatchers send links _to_ each caller’s own mobile (`callerPhoneE164` / `callerPhone` in the API). Do **not** put the sending number in those request fields — it is **not** a recipient.
- **A2P 10DLC registration:** required for **`+14707482763`**. Brand and campaign must be approved **and the number assigned to the campaign** before production sends. Use **only** for the registered NexCort iQ use case: dispatcher-initiated, incident-specific SMS/MMS to people who contacted 911/public safety and gave consent — **not** marketing, demos-at-scale, newsletters, or general sales outreach.
- Per-agency senders live in the SMS routing table and are passed as `OriginationIdentity` on `SendTextMessage`.

### Operations

- `SMS_PROVIDER`: `aws` (End User Messaging `SendTextMessage`) or `mock`. Legacy values `twilio`, `auto`, and `sns` map to `aws` at runtime.
- `MOCK_SMS_PROVIDER` / `INCIDENT_MEDIA_SMS_MOCK` force the mock path (no live send).
- `MEDIA_UPLOAD_TOKEN_TTL_SECONDS` overrides token lifetime when set; otherwise `INCIDENT_MEDIA_TOKEN_TTL_MINUTES` applies.
- SMS copy intentionally omits incident specifics; only the secure upload link is included.
- Delivery receipts arrive on the AWS SMS delivery-events Lambda when the send uses a configuration set.

### Content

- Keep messages short, transactional, and consent-oriented. Do not embed CAD notes, addresses, or names in SMS.
- **Default outbound template** (link is the real presigned path root + token):  
  `NexCort iQ: A dispatcher requested a secure link for your active incident. Sharing is optional. Upload here: https://<public-app-host>/media/upload/<token>`
