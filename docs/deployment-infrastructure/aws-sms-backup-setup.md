# AWS SMS backup (Twilio primary, Amazon SNS send path)

This runbook explains how Rapid Cortex uses **Amazon SNS** for application-side SMS delivery, how **AWS End User Messaging SMS** (Pinpoint SMS Voice v2 API / `pinpoint-sms-voice-v2` in the CLI) fits underneath, and how to verify or bootstrap resources with the provided scripts.

## Two layers (do not confuse them)

1. **Sending in the app (Rapid Cortex API)**  
   Outbound SMS uses the **Amazon SNS `Publish` API** with `PhoneNumber` set to an E.164 destination. The API sets transactional SMS message attributes (for example `AWS.SNS.SMS.SMSType` = `Transactional`).  
   Configure routing with environment variables such as `SMS_PROVIDER` and `SMS_PRIMARY_PROVIDER` (see below). Twilio credentials live in **AWS Secrets Manager** (`TWILIO_SECRET_ARN` or `INCIDENT_MEDIA_TWILIO_SECRET_ARN`), not in plain environment variables.

2. **Operational SMS platform (AWS account / region)**  
   **AWS End User Messaging SMS** manages origination identities, **phone pools**, **configuration sets**, **event destinations**, and account **sandbox vs production** tier. These are created and inspected with the AWS CLI service **`pinpoint-sms-voice-v2`** (for example `describe-account-attributes`, `create-pool`, `create-configuration-set`, `create-event-destination`).  
   The Lambda functions do not need to call these APIs at runtime for a normal send path; the scripts are for **operators** bootstrapping the account. Optional read-only IAM on API roles is included for future diagnostics.

## Account tier: sandbox vs production

- Check tier: `aws pinpoint-sms-voice-v2 describe-account-attributes --region REGION`  
  Look for attribute name `ACCOUNT_TIER` (`SANDBOX` or `PRODUCTION`).
- **Sandbox** limits who you can message; use verified numbers for testing. To move to **production** in a region, open an **AWS Support** case and request production access / limit increase for End User Messaging SMS in that region.

## Scripts

### Check readiness

```bash
export AWS_REGION=us-east-1
# Optional: expected resources after setup
export AWS_SMS_POOL_ID=pool-xxxxx
export AWS_SMS_CONFIGURATION_SET_NAME=rapid-cortex-sms
export AWS_SMS_EVENT_DESTINATION_NAME=rapid-cortex-events

./scripts/check-aws-sms-backup.sh
```

- Prints **PASS** / **FAIL** for `describe-account-attributes`, and (when set) pool, configuration set, and event destination.
- By default, **sandbox** tier causes **FAIL** (not ideal as unrestricted failover). For staging-only checks:  
  `AWS_SMS_CHECK_ALLOW_SANDBOX=1 ./scripts/check-aws-sms-backup.sh`  
- Exits **non-zero** if checks fail (including sandbox unless allowed).

### Bootstrap (idempotent)

```bash
export AWS_REGION=us-east-1
export AWS_SMS_POOL_NAME=rapid-cortex-sms-pool
export AWS_SMS_CONFIGURATION_SET_NAME=rapid-cortex-sms
# Required for create-pool: origination identity from your account (phone number or sender ID ARN/ID)
export AWS_SMS_ORIGINATION_IDENTITY_ARN=arn:aws:sms-voice:us-east-1:123456789012:phone-number/phone-x
export AWS_SMS_POOL_ISO_COUNTRY_CODE=US
# Optional event routing to an SNS topic
export AWS_SMS_EVENT_DESTINATION_NAME=rapid-cortex-events
export AWS_SMS_EVENT_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:rc-sms-events

./scripts/setup-aws-sms-backup.sh
```

- Verifies the AWS CLI is installed and authenticated.
- Creates a **phone pool** only if `AWS_SMS_ORIGINATION_IDENTITY_ARN` is set; if a pool with tag `Name=<pool name>` already exists, it is **reused**.
- Creates a **configuration set** if the name is provided and it does not exist.
- Creates an **event destination** (SNS) only if **both** `AWS_SMS_EVENT_DESTINATION_NAME` and `AWS_SMS_EVENT_SNS_TOPIC_ARN` are set.

## Application environment variables

| Variable | Purpose |
|----------|---------|
| `SMS_PROVIDER` | `twilio` \| `aws` \| `auto` \| `mock` — routing mode. |
| `SMS_PRIMARY_PROVIDER` | `twilio` \| `aws` — in `auto`, which provider to try first; the other is failover on **retryable** errors. |
| `AWS_SMS_REGION` | Region for the SNS client (falls back to `AWS_REGION` if empty). |
| `AWS_SMS_POOL_ID` | Logged for operations; **End User Messaging** pool id if you use pools. |
| `AWS_SMS_CONFIGURATION_SET_NAME` | Logged for operations; configuration set is managed in End User Messaging (see AWS docs for SNS + configuration sets in your account). |
| `AWS_SMS_USE_SIMULATOR` | `true` — do not call SNS; return a dry-run style success (for local/staging). |
| `MOCK_SMS_PROVIDER` | `true` — force mock provider (no Twilio, no AWS). |
| `INCIDENT_MEDIA_SMS_MOCK` | Legacy: same idea as mock paths when `true`. |
| `TWILIO_SECRET_ARN` | Preferred name for the Secrets Manager Twilio secret. |
| `INCIDENT_MEDIA_TWILIO_SECRET_ARN` | Legacy alias for the same secret. |
| `TWILIO_MESSAGING_PHONE_NUMBER` | Optional — E.164 of **approved toll-free** for runbooks/dashboards (**`+18556293679`**). Not required for send when secret JSON includes `messagingServiceSid`. |
| `TWILIO_SMS_FROM` | Optional — same as above for SMS lineage docs. |
| `TWILIO_MMS_FROM` | Optional — same for MMS lineage docs. |

**Secrets:** do not put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_*`, or `TWILIO_MESSAGING_SERVICE_SID` in raw Lambda env vars; store them **only** in the JSON blob behind `TWILIO_SECRET_ARN` / `INCIDENT_MEDIA_TWILIO_SECRET_ARN`.

## Safe failover testing in staging

1. Set `SMS_PROVIDER=auto` and `SMS_PRIMARY_PROVIDER=twilio` (or `aws` to test the reverse).  
2. Use `MOCK_SMS_PROVIDER` / `AWS_SMS_USE_SIMULATOR` only for fully offline tests.  
3. For integration tests against real providers, use a **sandbox** number and temporarily force a **retryable** failure on the primary (or use `SMS_PROVIDER=aws` alone) while monitoring **CloudWatch** logs for `routing_complete` and `routing_attempt` JSON lines.  
4. `scripts/check-aws-sms-backup.sh` with `AWS_SMS_CHECK_ALLOW_SANDBOX=1` confirms API access without requiring production.

## Alarms

CloudWatch metric `OutboundSmsRoutingFailures` (namespace `RapidCortex/Sms`) is emitted from log metric filters on incident media and live video Lambdas when structured `routing_complete` lines show `finalStatus: failed`. An alarm is defined in `infra/template.yaml`.

## Manual prerequisites operators still do

- Request **production** SMS in the target region if you need non-sandbox delivery.
- **Provision origination** (dedicated long code, 10DLC, sender ID, etc.) in **End User Messaging** per your jurisdiction; obtain the **origination identity** ARN or id for `create-pool` when using pools.
- Ensure the **SNS** principal can send SMS in the account (spend limits, SMS opt-out, regional rules).
- If you add an event destination to an **SNS topic**, attach a policy that allows the End User Messaging service to publish (see AWS documentation for the exact service principal and condition keys for your region).
