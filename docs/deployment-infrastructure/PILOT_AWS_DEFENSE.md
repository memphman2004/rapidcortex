# Pilot AWS defense — WAF, API throttling, alerting, CORS, Cognito

Concise runbook for **911-agency pilot** hardening. Infra is defined in `infra/template.yaml`.

## 1. AWS WAF (API Gateway)

- **Parameters:** `EnableApiWaf=true`, optional `WafRateLimitPer5Min` (default **2000** requests per 5 minutes **per source IP** in the WAF rate-based rule; AWS uses fixed evaluation windows).
- **What gets deployed:** a **REGIONAL** `AWS::WAFv2::WebACL` with:
  - `AWSManagedRulesCommonRuleSet`
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - A **per-IP block** when the request count exceeds the rate limit (throttling at the edge, before your Lambdas in many cases).
- **Association (important):** WAFv2 **regional** association supports REST API stages, ALBs, AppSync, Cognito — **not** API Gateway **HTTP APIs** (v2).  
  CLI attempt **2026-07-29** against primary HttpApi `k26yw4o3xk` stage `$default`:
  ```text
  aws wafv2 associate-web-acl \
    --web-acl-arn arn:aws:wafv2:us-east-1:158961537080:regional/webacl/rapid-cortex-httpapi-waf-dev/4b66008e-f221-4de5-80c0-7a28152cce38 \
    --resource-arn arn:aws:apigateway:us-east-1::/apis/k26yw4o3xk/stages/$default
  → WAFInvalidParameterException: The ARN isn't valid. … field: RESOURCE_ARN
  ```
  **Do not** reintroduce `AWS::WAFv2::WebACLAssociation` on the HttpApi stage in SAM — it rolls back the same way.

- **Pilot edge path (LIVE 2026-07-29):** CloudFront in front of primary `api.rapidcortex.us` with a **CLOUDFRONT**-scope WebACL.
  - Template: [`infra/api-edge-cloudfront.yaml`](../../infra/api-edge-cloudfront.yaml)
  - Deploy: `scripts/deploy-api-edge.sh`
  - Stack: `rapid-cortex-api-edge-dev`
  - Distribution: `E22OK65GJG6A2C` (`d2nmlvfqle5i0g.cloudfront.net`)
  - WebACL: `arn:aws:wafv2:us-east-1:158961537080:global/webacl/rapid-cortex-httpapi-cdn-waf-dev/7f68bde8-cc59-4b9d-bed7-dd1f66e7eeef` (attached on the distribution)
  - Origin: API Gateway regional custom-domain target (CloudFront-internal; **do not publish** `*.execute-api.*` hostnames to agencies)
  - Public hosts only: `https://api.rapidcortex.us` and `https://app.rapidcortex.us`
  - Verify: browser UA to `https://api.rapidcortex.us/api/health` → `{"status":"ok",...}` (raw `curl` is blocked by Bot Control `CategoryHttpLibrary`)
  - Bot Control COMMON = **Block**; AnonymousIp = **Block** with `HostingProviderIPList` → **Count** (agency VPN / cloud ops)
  - DNS ownership: cut over Route53 A/AAAA to CloudFront; set AppSam `ManageApiDomainDns=false` then `CREATE_ROUTE53_ALIAS_RECORDS=true` so the edge stack owns DNS in CFN.
- **Not replaced:** **API Gateway stage throttling** (`DefaultRouteSettings` on the `Serverless::HttpApi` resource: burst **200** / rate **100** RPS) remains in effect.
- **Cost:** WAF is billed per web ACL, rules, and requests — enable for **pilot/prod**; leave `false` in pure local/dev if unused.
- **Deploy (example):**  
  `ENABLE_API_WAF=true WAF_RATE_LIMIT_5M=2000 ./scripts/deploy.sh pilot`  
  plus API edge: see `scripts/deploy-api-edge.sh`.

**Output:** `ApiWebAclArn` when the REGIONAL WebACL resource is created (inventory / ALB). **Live traffic protection** is `ApiEdgeWebAclArn` on the CloudFront distribution.

## 2. CloudWatch → SNS → email (and SMS)

- **SNS topic:** `OpsAlertsTopic` — many Lambda and API **5xx / latency** alarms use `AlarmActions: !Ref OpsAlertsTopic`. Deception Shield HIGH/CRITICAL decoy hits also publish here.
- **Security topic:** `rapid-cortex-security-alerts-{stage}` — dual-publish target for Deception Shield + GuardDuty HIGH/CRITICAL (EventBridge rule `rapid-cortex-guardduty-high-critical-dev` → SNS).
- **GuardDuty:** detector `7ed0e07082b39d1dfc6cc32c6ee10ec2` **ENABLED** (manage via CareTally iQ IAM; `rapid-cortex-deploy` lacks GuardDuty APIs). Finding publish frequency FIFTEEN_MINUTES.
- **Email:** subscribe ops mailboxes and **Confirm** the AWS SNS email (pending until confirmed). Targets: `Jwcoleman@rapidcortex.us`, `support@nexcortiq.us`.
- **SMS (optional):** `SnsSmsSubscription` for E.164 numbers where your account/region allows SMS.
- There is no automatic “paging” policy in-repo — connect SNS to PagerDuty/Opsgenie in the AWS console if required.

## 2b. Deception Shield

- Lambda `DeceptionDecoyHttpFunction` with `DECEPTION_SHIELD_ENABLED=true`, `DECEPTION_ALERTS_ENABLED=true`.
- Decoy hits → DynamoDB `rapid-cortex-deception-events-{stage}` + (HIGH/CRITICAL) SNS → OpsAlerts + security-alerts.
- Agency-facing host remains `https://api.rapidcortex.us` only — see [PUBLIC_API_HOSTNAMES.md](../security/PUBLIC_API_HOSTNAMES.md).

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
