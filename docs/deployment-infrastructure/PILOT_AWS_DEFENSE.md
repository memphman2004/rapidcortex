# Pilot AWS defense — WAF, API throttling, alerting, CORS, Cognito

Concise runbook for **911-agency pilot** hardening. Infra is defined in `infra/template.yaml`.

## 1. AWS WAF (API Gateway)

- **Parameters:** `EnableApiWaf=true`, optional `WafRateLimitPer5Min` (default **2000** requests per 5 minutes **per source IP** in the WAF rate-based rule; AWS uses fixed evaluation windows).
- **What gets deployed:** a **REGIONAL** `AWS::WAFv2::WebACL` with:
  - `AWSManagedRulesCommonRuleSet`
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - A **per-IP block** when the request count exceeds the rate limit (throttling at the edge, before your Lambdas in many cases).
- **Association:** `AWS::WAFv2::WebACLAssociation` targets the **HTTP API** default stage:  
  `arn:aws:apigateway:<region>::/apis/<api-id>/stages/$default`
- **Not replaced:** **API Gateway stage throttling** (`DefaultRouteSettings` on the `Serverless::HttpApi` resource: burst **200** / rate **100** RPS) remains in effect. WAF and stage limits stack.
- **Cost:** WAF is billed per web ACL, rules, and requests — enable for **pilot/prod**; leave `false` in dev to avoid surprise spend.
- **Deploy (example):**  
  `ENABLE_API_WAF=true WAF_RATE_LIMIT_5M=2000 ./scripts/deploy.sh pilot`

**Output:** `ApiWebAclArn` when WAF is enabled.

## 2. CloudWatch → SNS → email (and SMS)

- **SNS topic:** `OpsAlertsTopic` — many Lambda and API **5xx / latency** alarms use `AlarmActions: !Ref OpsAlertsTopic`.
- **Email:** set **parameter** `SnsEmailSubscription` to an operations mailbox (e.g. via `SNS_EMAIL_SUBSCRIPTION` in `./scripts/deploy.sh`). **Confirm the subscription** in the inbox after deploy (AWS sends a confirm link).
- **SMS (optional):** `SnsSmsSubscription` for E.164 numbers where your account/region allows SMS.
- There is no automatic “paging” policy in-repo — connect SNS to PagerDuty/Opsgenie in the AWS console if required.

## 3. CORS and production domains

- **Parameter:** `HttpApiCorsAllowedOrigins` — **comma-separated** list, **no spaces**, e.g.  
  `https://www.rapidcortex.us,https://app.rapidcortex.us`  
  Do **not** use `*` for pilot/production (`./scripts/deploy.sh` warns when unset for non-dev).
- **Web app** should use `NEXT_PUBLIC_AUTH_PROXY=1` and a same-site origin so cookies stay scoped; the Next.js `app/api/backend` proxy adds `Authorization: Bearer` from **httpOnly** cookies.

## 4. Cognito redirect URIs (web + desktop)

- **Web / Next.js:** callback URLs for the Hosted UI must match the **Cognito app client** “Allowed callback URLs” (e.g. `https://app.<root>/...` or jurisdiction routes — align with your deploy).
- **macOS:** custom URL scheme (see `apps/desktop-macos/README.md`); must match **exactly** in Cognito.
- **Windows:** loopback default `http://127.0.0.1:8765/callback` — add the **same** string to Cognito **Callback URLs** and to `appsettings` / `RapidCortex__Cognito__RedirectUri`.

## 5. Transcript retention policy (stack)

- **Parameter:** `TranscriptRetentionPolicyDays` (string, may be empty). Passed to all API Lambdas as **`TRANSCRIPT_RETENTION_POLICY_DAYS`** for **policy / SOP** alignment (the stack does **not** auto-delete DynamoDB items by this number).  
  See [TRANSCRIPT_RETENTION_POLICY.md](./TRANSCRIPT_RETENTION_POLICY.md) and [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md).
