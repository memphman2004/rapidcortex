# AWS End User Messaging SMS (send, receive, delivery events)

This runbook covers how Rapid Cortex sends and receives SMS through **AWS End User Messaging SMS**, and the 10DLC registration steps an operator must complete in the console first.

> **Naming, because it is genuinely confusing.** The service is *AWS End User Messaging SMS*. Its API, CLI service name, and SDK package are all still called `pinpoint-sms-voice-v2`. Amazon Pinpoint itself reaches **end of support on 2026-10-30**, but the SMS, voice, push, and OTP APIs are explicitly carved out and continue under End User Messaging. Do **not** create a Pinpoint project, and do not use the `@aws-sdk/client-pinpoint` package — that is the retiring v1 surface.

- Console: <https://console.aws.amazon.com/sms-voice/>
- SDK package: `@aws-sdk/client-pinpoint-sms-voice-v2`
- CLI: `aws pinpoint-sms-voice-v2 ...`

## Why not plain Amazon SNS

The earlier send path used the SNS `Publish` API. SNS cannot select an origination number per message — it picks from account-level settings — and it cannot receive inbound SMS at all. Both are requirements here: each agency sends from its own number, and residents must be able to reply. `SendTextMessage` with `OriginationIdentity` replaces it.

## 10DLC registration — order matters

You **cannot** request a 10DLC number first. AWS requires an approved brand and an approved campaign to associate the number with, so the sequence is fixed:

1. **Register the brand** (`US_TEN_DLC_BRAND_REGISTRATION`). Typically 1–2 business days for a US company.
2. **Apply for brand vetting** (`US_TEN_DLC_BRAND_VETTING`). Optional but recommended — it raises the throughput (MPS) ceiling and takes another 1–2 days. This is a separate paid filing, not part of the brand registration.
3. **Register the campaign** (`US_TEN_DLC_CAMPAIGN_REGISTRATION`), referencing the approved brand. **Budget up to 4 weeks.**
4. **Request the phone number.** Originator type **10DLC** (not "long code" — a plain long code needs a Support case), associated with the approved campaign. Up to 10 days.

End to end this is realistically six to seven weeks. Note also that 10DLC resources are **per region**: sending from a second region means repeating the whole registration there.

### Account and credentials

All Rapid Cortex SMS resources live in account **158961537080**, region **us-east-1**. The `default` AWS profile on a dev machine may point at an unrelated account, so always run these commands with:

```bash
export AWS_PROFILE=rapid-cortex
```

`setup-aws-10dlc.sh` refuses to run if the resolved account is anything other than 158961537080. This is not cosmetic: a 10DLC filing submitted from the wrong account registers the company EIN with TCR under that account and must be unwound before it can be filed correctly.

The IAM principal needs `sms-voice` registration, phone-number, pool, and configuration-set permissions. `rapid-cortex-deploy` currently has none of them — even `DescribeRegistrations` is denied — so that policy has to be attached before any of this runs:

```bash
aws iam put-user-policy --user-name rapid-cortex-deploy \
  --policy-name RapidCortexSmsVoiceAdmin \
  --policy-document file://infra/iam/rapid-cortex-sms-voice-admin-policy.json
```

The mutating statements are scoped to `us-east-1` ARNs in account 158961537080. The read/discovery statement uses `Resource: "*"` because the `Describe*` and `List*` operations in this service are account-level and do not accept resource-level constraints — there is no narrower form that still works.

### Doing it from the CLI

AWS's docs state that 10DLC registration is console-only. That note is stale — the SMS Voice v2 API exposes the entire flow, and `scripts/setup-aws-10dlc.sh` drives it:

```bash
./scripts/setup-aws-10dlc.sh status            # registrations, account tier, verified numbers
./scripts/setup-aws-10dlc.sh fields BRAND      # field paths + allowed SELECT values
./scripts/setup-aws-10dlc.sh fields CAMPAIGN

cp scripts/aws-10dlc/brand.example.json scripts/aws-10dlc/brand.json   # then edit every REPLACE
export AWS_10DLC_BRAND_FIELDS_FILE=scripts/aws-10dlc/brand.json

./scripts/setup-aws-10dlc.sh brand             # prints the exact commands, changes nothing
APPLY=1 ./scripts/setup-aws-10dlc.sh brand     # actually files it
```

Every subcommand is a dry run unless `APPLY=1`. Field values come from a JSON file of `{"fieldPath": value}` rather than flags, so message samples can contain commas and newlines, and the company EIN stays out of git (`scripts/aws-10dlc/*.json` is ignored; only `*.example.json` is tracked). Registration ids are recorded in `.aws-10dlc-state.json`, so re-running a partly-failed step reuses the existing filing instead of opening a second one.

Run `fields` before filling anything in: most campaign fields are `SELECT` with a fixed option list, and the script rejects an unknown field path rather than submitting a partial filing.

#### Filing gotchas

These cost a denial cycle each on the first brand filing:

- **EIN must have no dash.** The dashed IRS form (`12-3456789`) fails `PutRegistrationFieldValue` with `INVALID_PARAMETER`; send the nine digits only (`123456789`).
- **`companyInfo.businessContactEmail` is only allowed for `PUBLIC_PROFIT` companies.** Sending it for a `PRIVATE_PROFIT` LLC gets the whole version denied with "Conditional field not allowed". The same applies to `stockSymbol` and `stockExchange`. `CONDITIONAL` in the `fields` output means *conditionally allowed*, not *optional*.
- **The campaign must be associated with the brand before it can be submitted.** Its association behavior is `ASSOCIATE_BEFORE_SUBMIT`, so `SubmitRegistrationVersion` fails with `SUBMIT_REGISTRATION_VERSION_NOT_ALLOWED` even when all 22 required fields are populated. Call `create-registration-association --registration-id <campaign> --resource-id <brand>` first — the script now does this automatically. The *phone number* association is the opposite (`ASSOCIATE_AFTER_COMPLETE`) and happens only once the campaign is approved.
- **A submitted version is frozen.** Editing raises `EDIT_REGISTRATION_FIELD_VALUES_NOT_ALLOWED`; recovering from a denial requires `create-registration-version`, and **that new version starts empty**, so every field must be re-put, not just the rejected one. The script handles this automatically and refuses to touch a registration that is still `REVIEWING`.

Check why a version was denied with:

```bash
aws pinpoint-sms-voice-v2 describe-registration-versions --region us-east-1 \
  --registration-id "$(jq -r .brandRegistrationId .aws-10dlc-state.json)" \
  --query 'RegistrationVersions[].{V:VersionNumber,Status:RegistrationVersionStatus,Denied:DeniedReasons}'
```

After the campaign is approved:

```bash
APPLY=1 ./scripts/setup-aws-10dlc.sh number

APPLY=1 AWS_SMS_PHONE_NUMBER_ID=… AWS_SMS_INBOUND_TOPIC_ARN=… \
        AWS_SMS_CONFIGURATION_SET_NAME=… AWS_SMS_DELIVERY_EVENTS_TOPIC_ARN=… \
        ./scripts/setup-aws-10dlc.sh wire
```

### You cannot choose the number

`RequestPhoneNumber` takes only a country, number type, and capabilities. There is **no area-code parameter and no API to search, browse, or reserve a specific number** — AWS assigns one from its inventory, and the console requests through the same API, so clicking does not help.

That matters for the per-agency sender design: agencies are supposed to text residents from a recognizable local number, and on AWS you cannot request an agency's area code. Options are to request numbers and accept whatever area codes come back, or port an existing 10DLC number into AWS (`RequestPhoneNumber` vs. number porting, which is a separate Support-driven process).

### Post-approval tasks (once the campaign clears and numbers exist)

HELP and STOP text lives in two independent places, which is what makes per-agency replies possible:

| Where | Scope | How to change | Review needed |
|---|---|---|---|
| Campaign registration `helpMessage` / `stopMessage` | One per campaign | New registration version, resubmit | Yes, back through TCR |
| Runtime keyword auto-reply | **Per phone number or pool** | `put-keyword` | No, takes effect immediately |

So the registered copy stays generic and company-level, while each agency's number can answer HELP with its own agency-specific text:

```bash
aws pinpoint-sms-voice-v2 put-keyword --region us-east-1 \
  --origination-identity <phone-number-id-or-pool-id> \
  --keyword HELP \
  --keyword-action AUTOMATIC_RESPONSE \
  --keyword-message "Columbus PD via Rapid Cortex. Help: 706-555-0100. Reply STOP to opt out."
```

Outstanding items to complete after approval:

- [ ] Keep the public HELP reply email-only (`support@rapidcortex.us`). Do not put a personal cell in customer-facing HELP text, privacy, or terms. Brand registration may still list a business support phone for TCR; that is separate from public HELP copy.
- [ ] Set per-number `HELP` and `STOP` keyword responses for each agency number.
- [ ] Keep the registered copy and the runtime replies consistent; carriers can audit that they match.

### Account tier and monthly spend (us-east-1)

New accounts start in the **SANDBOX** tier (verified destinations only). Leaving sandbox is an AWS Support request **independent of 10DLC**.

**As of 2026-09-14 this account is PRODUCTION.** AWS approved a **$50/month** TEXT spend max in `us-east-1`. Check both the tier and the *enforced* cap — approval of `MaxLimit` does not always raise `EnforcedLimit`:

```bash
export AWS_PROFILE=rapid-cortex
./scripts/check-aws-sms-backup.sh --region us-east-1

aws pinpoint-sms-voice-v2 describe-account-attributes --region us-east-1
aws pinpoint-sms-voice-v2 describe-spend-limits --region us-east-1
```

If TEXT `EnforcedLimit` is still `1` after approval:

```bash
aws pinpoint-sms-voice-v2 set-text-message-spend-limit-override \
  --monthly-limit 50 \
  --region us-east-1
```

Do **not** use `aws pinpoint update-sms-channel` or `aws sms-voice update-phone-number-settings`. Those are classic Pinpoint / a different CLI surface. Rapid Cortex sends with `SendTextMessage` on `pinpoint-sms-voice-v2`.

Sandbox destination verification is optional now. Keep `./scripts/setup-aws-10dlc.sh verify` only if you need a known-good handset on a sandbox region.

Live origination (10DLC, two-way, campaign COMPLETE): **+1 319-835-8230**. Brand and campaign registrations are COMPLETE. AppSam5Stack creates configuration set `${AppName}-sms-${DeploymentStage}` when `AwsSmsConfigurationSetName` is blank, and attaches TEXT_ALL events to `AwsSmsDeliveryEventsTopic`. Extra per-agency numbers are the remaining scale work — not another sandbox ticket.

## Wiring the AWS resources to Rapid Cortex

The nested stack `infra/nested/stack-app-sam-5.yaml` creates two SNS topics and exports their ARNs, because AWS delivers both inbound messages and delivery events to SNS rather than to an HTTP webhook:

| Stack output | Where it attaches |
|---|---|
| `AwsSmsInboundTopicArn` | The phone number's **two-way SMS** destination |
| `AwsSmsDeliveryEventsTopicArn` | The configuration set's **SNS event destination** |

`setup-aws-10dlc.sh wire` attaches both; the console is only needed if you prefer clicking. The topic policy allowing `sms-voice.amazonaws.com` to publish is already created by the stack, scoped by `aws:SourceAccount`.

Then leave `AwsSmsConfigurationSetName` blank at deploy time so stack 5 creates `rapid-cortex-sms-{stage}` and attaches it to every send. Override the parameter only to import an existing set.

If `AWS_SMS_CONFIGURATION_SET_NAME` is unset, sends still work but **no delivery events are emitted** — an accepted send and a carrier-blocked one become indistinguishable, which is exactly the blind spot that hid the undelivered Ring consent SMS.

## How the sender is chosen

`resolveOriginationIdentity` in `apps/api/src/services/sms/awsSmsProvider.ts` picks, in order:

1. **The agency's own number**, resolved from the `SmsRoutingRecord` table by `agencyId`. This is the per-agency branding and tenant-isolation path.
2. **`AWS_SMS_POOL_ID`**, the shared pool, when the agency has no registered number.
3. **Nothing** — AWS auto-selects from the account.

The same table drives inbound routing, so a number registered to an agency both sends as that agency and routes replies back to it. Register agency numbers with `scripts/seed-agency-sms-sender-dev.ts`.

## Application environment variables

| Variable | Purpose |
|----------|---------|
| `SMS_PROVIDER` | `aws` \| `mock` — routing mode. Legacy `twilio` / `auto` / `sns` map to `aws`. |
| `AWS_SMS_REGION` | Region for the End User Messaging client (falls back to `AWS_REGION`). |
| `AWS_SMS_POOL_ID` | Shared origination pool, used when an agency has no number of its own. |
| `AWS_SMS_CONFIGURATION_SET_NAME` | Attached to every send; **required for delivery events**. |
| `SMS_ROUTING_TABLE` | Per-agency number table. Unset means every agency uses the shared sender. |
| `AWS_SMS_USE_SIMULATOR` | `true` — do not call AWS; return a dry-run success (local/staging). |
| `MOCK_SMS_PROVIDER` | `true` — force mock provider (no AWS send). |

## Account tier: sandbox vs production

- Check: `./scripts/setup-aws-10dlc.sh status`, or `aws pinpoint-sms-voice-v2 describe-account-attributes --region us-east-1` and look for `ACCOUNT_TIER`.
- **us-east-1 is PRODUCTION** (sandbox lifted 2026-09-14). TEXT monthly spend is \$50 enforced. Other regions still start in SANDBOX until a separate Support request.
- `scripts/check-aws-sms-backup.sh` reports tier, spend cap, origination numbers, and optional pool/config-set presence.

## Observability

All send paths emit structured JSON to CloudWatch:

- `outcome: "accepted"` with `senderScope` (`agency` \| `pool` \| `account`) and `sender` — which number the message actually went out from.
- `event: "delivery_event"` from `AwsSmsDeliveryEventsFunction` — the terminal handset outcome. Carrier blocks log at **error** level.
- `event: "routed"` from `AwsSmsInboundFunction` — inbound replies, with the routing outcome.

Recipient numbers are redacted in every log line; our own sending number is not, since knowing it is the point.

CloudWatch metric `OutboundSmsRoutingFailures` (namespace `RapidCortex/Sms`) is emitted from log metric filters on `routing_complete` lines with `finalStatus: failed`; the alarm lives in `infra/template.yaml`.

## Error handling

Non-retryable AWS errors (`AccessDeniedException`, `ResourceNotFoundException`, `ServiceQuotaExceededException`, invalid numbers, opt-out) fail the send. Retryable errors (throttling, timeouts) are classified on the result for callers; there is no second-provider failover.
