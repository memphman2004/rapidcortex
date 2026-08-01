# Incident media SMS (dual provider)

## Deployment checklist

### AWS (SNS direct / transactional SMS path)

- Confirm the account and target region are out of the SMS sandbox before production traffic.
- Configure origination sender ID, default SMS type, spend limits, and opt-out behavior in the AWS SMS console for the deployment region.
- In lower environments, set `AWS_SMS_USE_SIMULATOR=true` (or `SMS_PROVIDER=mock`) so Lambdas do not require live SMS delivery.
- Exercise a real send in staging with a verified destination number before promoting.
- Review CloudWatch metrics and SNS delivery logs; align alarms with `IncidentMediaHttpErrorsAlarm` / `PublicIncidentMediaHttpErrorsAlarm`.

### Twilio (fallback / alternate)

- Create a Messaging Service and attach approved sender numbers or short codes as required for your jurisdiction.
- **Rapid Cortex sending number (outbound-only sender):** production identity **`+1 (470) 748-2763`** (E.164: **`+14707482763`**), a US local **10DLC** number. This is the **from** side for Twilio (or analogous origination for AWS SMS): **dispatchers send links _to_ each caller’s own mobile** (`callerPhoneE164` / `callerPhone` in the API). Do **not** put the sending number in those request fields—it is **not** a recipient; it is **outbound-only** for delivering secure media and live-video links to callers.
- **A2P 10DLC registration:** required for **`+14707482763`**. Brand and campaign must be approved **and the number assigned to the campaign** before production sends — an unregistered 10DLC sender is accepted by Twilio and then dropped by US carriers (error **30034**), which looks like a successful send in our logs. Keep the campaign approval on file with your deployment evidence package. Use **only** for the registered Rapid Cortex use case: dispatcher-initiated, incident-specific SMS/MMS to people who contacted 911/public safety and gave consent — **not** marketing, demos-at-scale, newsletters, or general sales outreach.
- **Retired sender:** toll-free **`+18556293679`** (Apps On Demand LLC), Toll-Free Messaging verification **APPROVED**, **Verification Request SID** `HH0d6af73f3875d5b5b416f7579f8144a2`. That verification is specific to the toll-free and **does not transfer** to the 10DLC number. Retain the approval notice as historical evidence.
- Add **`+14707482763`** to the **same Twilio Messaging Service** whose SID you store in Secrets Manager (`messagingServiceSid`), and remove the retired sender from that pool so Twilio cannot select it. When you use a Messaging Service, Twilio selects an approved sender from the pool, so **the number is changed in the Twilio Console, not in this repo**; the optional env aligns (`TWILIO_MESSAGING_PHONE_NUMBER`, `TWILIO_SMS_FROM`, `TWILIO_MMS_FROM`) are runbook documentation only — see root **`.env.example`**. Only a secret using the legacy `fromE164` shape requires a Secrets Manager edit.
- Store Twilio **account SID**, **auth token** (or **API key** SID + secret), and **Messaging Service SID** in **Secrets Manager only** — never as raw Lambda env vars. Supported JSON shapes:
  - **Preferred:** `accountSid`, `apiKeySid`, `apiKeySecret`, `messagingServiceSid`
  - **Legacy:** `accountSid`, `authToken`, and either `messagingServiceSid` or `fromE164`
- Pass the secret ARN via stack parameter `IncidentMediaTwilioSecretArn` (or env `TWILIO_SECRET_ARN` when overriding at deploy time).
- Separate test vs production Twilio accounts; never reuse production secrets in dev.

### Operations

- `SMS_PROVIDER`: `aws` (SNS publish), `twilio`, `auto` (order set by **`SMS_PRIMARY_PROVIDER`**, default **twilio** first; the other provider on **retryable** failure when configured), or `mock`.
- `MOCK_SMS_PROVIDER` / `INCIDENT_MEDIA_SMS_MOCK` force the mock path (no live send).
- `MEDIA_UPLOAD_TOKEN_TTL_SECONDS` overrides token lifetime when set; otherwise `INCIDENT_MEDIA_TOKEN_TTL_MINUTES` applies.
- **Auto failover:** The **secondary** provider runs only when the **primary** attempt fails with a **retryable** error (e.g. throttling / 5xx). Non-retryable failures do not fail over.
- SMS copy intentionally omits incident specifics; only the secure upload link is included.

### Content

- Keep messages short, transactional, and consent-oriented. Do not embed CAD notes, addresses, or names in SMS.
- **Default outbound template** (link is the real presigned path root + token):  
  `Rapid Cortex: A dispatcher requested a secure link for your active incident. Sharing is optional. Upload here: https://<public-app-host>/media/upload/<token>`
- **Twilio:** Outbound sends use the **Messaging Service SID** from Secrets Manager (`messagingServiceSid`); that is separate from inbound webhook configuration in Twilio’s docs.
