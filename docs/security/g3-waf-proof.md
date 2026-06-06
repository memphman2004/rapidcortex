# G3 Evidence — AWS WAF (API Gateway Regional)

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** INFRA READY — SAM defines WAF resources; **EnableApiWaf** defaults `false`; attach **before** treating edge protection as LIVE.

## Definitions (`infra/template.yaml`)

- Conditional resource **`ApiWebAcl`** (`AWS::WAFv2::WebACL`, `Scope: REGIONAL`) when `EnableApiWaf=true`.
- Association **`ApiWebAclAssociation`** targets API Gateway HTTP API `$default` stage ARN.
- **Managed rule groups:**
  - `AWSManagedRulesCommonRuleSet`
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - `AWSManagedRulesAmazonIpReputationList`
- **Rate limit:** rule `PerIpRateLimit` using `WafRateLimitPer5Min` (requests / 5 min / IP).

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

### Manual attachments

Attach CloudWatch sampled request screenshots plus ACL association evidence per deployment stage (console export or ticketing link).
