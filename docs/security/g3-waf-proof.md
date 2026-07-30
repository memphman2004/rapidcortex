# G3 Evidence — AWS WAF (API Gateway Regional)

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** **API edge LIVE (2026-07-29).** CloudFront distribution `E22OK65GJG6A2C` fronts `api.rapidcortex.us` with CLOUDFRONT-scope WebACL `rapid-cortex-httpapi-cdn-waf-dev` (`7f68bde8-cc59-4b9d-bed7-dd1f66e7eeef`) attached (`WebACLId` on the distribution). Origin = regional API custom-domain target `d-zp1gcdowhi.execute-api.us-east-1.amazonaws.com`. Verify: `curl https://api.rapidcortex.us/api/health` → 200 + `via: …cloudfront.net`.  

HttpApi stage associate remains **unsupported** (expected). REGIONAL ACL `rapid-cortex-httpapi-waf-dev` may still exist for inventory/ALB. Root `EnableApiWaf` / nested association: do **not** reintroduce `ApiWebAclAssociation` on HTTP API stages. Infra: `infra/api-edge-cloudfront.yaml` + `scripts/deploy-api-edge.sh`.

## Definitions (`infra/nested/stack-app-sam.yaml`)

- Conditional resource **`ApiWebAcl`** (`AWS::WAFv2::WebACL`, `Scope: REGIONAL`) when `EnableApiWaf=true`.
- **No** `ApiWebAclAssociation` on the HttpApi stage (unsupported by AWS WAF).
- **Managed rule groups:**
  - `AWSManagedRulesCommonRuleSet`
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - `AWSManagedRulesAmazonIpReputationList`
- **Rate limit:** rule `PerIpRateLimit` using `WafRateLimitPer5Min` (requests / 5 min / IP).
- **CloudTrail bucket:** use `ObjectLockEnabled: true` (not CLI-only `ObjectLockEnabledForBucket`).

## Enable for pilot/production

Deploy with `EnableApiWaf=true` (stack parameter) and tune `WafRateLimitPer5Min`.

### CLI verification

```bash
aws wafv2 list-web-acls --scope REGIONAL --limit 100 \
  --query "WebACLs[?starts_with(Name,'rapid cortex')||starts_with(Name,'rapid-cortex')||starts_with(Name,'Rapid')]
          .{Name:Name,Id:Id,ARN:ARN}"

# Then:
aws wafv2 get-web-acl --scope REGIONAL \
  --id REPLACE_ID --name REPLACE_NAME \
  --query '{Name:WebACL.Name,Rules:join(`,`,Rules[].Name)}'
```

### Associate attempt — 2026-07-29 (FAIL)

Primary HttpApi: `k26yw4o3xk` (AppSamStackV2). WebACL ARN confirmed.

```text
$ aws wafv2 associate-web-acl \
    --web-acl-arn arn:aws:wafv2:us-east-1:158961537080:regional/webacl/rapid-cortex-httpapi-waf-dev/4b66008e-f221-4de5-80c0-7a28152cce38 \
    --resource-arn arn:aws:apigateway:us-east-1::/apis/k26yw4o3xk/stages/$default \
    --profile rapid-cortex --region us-east-1

An error occurred (WAFInvalidParameterException) when calling the AssociateWebACL operation:
Error reason: The ARN isn't valid. A valid ARN begins with arn: and includes other information
separated by colons or slashes., field: RESOURCE_ARN,
parameter: arn:aws:apigateway:us-east-1::/apis/k26yw4o3xk/stages/$default

$ aws wafv2 get-web-acl-for-resource \
    --resource-arn arn:aws:apigateway:us-east-1::/apis/k26yw4o3xk/stages/$default \
    --profile rapid-cortex --region us-east-1 --query 'WebACL.Name' --output text

An error occurred (WAFInvalidParameterException) … field: RESOURCE_ARN,
parameter: arn:aws:apigateway:us-east-1::/apis/k26yw4o3xk/stages/$default
```

**Confirmation:** no association — `get-web-acl-for-resource` cannot succeed against an HTTP API stage ARN. Checklist updated: [PILOT_READINESS_CHECKLIST.md](../deployment-infrastructure/PILOT_READINESS_CHECKLIST.md) §6.

### Manual attachments

Attach CloudWatch sampled request screenshots plus **CloudFront/ALB** ACL association evidence per deployment stage (console export or ticketing link). Do not expect HttpApi `$default` association proof.
