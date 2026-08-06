# Security hardening — WAF (existing ACLs)

This folder holds the **reference** design from the standalone security-hardening package. Production uses the **merged** rules on existing ACLs — not a separate `rapid-cortex-security-hardening-*` stack.

## Access policy (product intent)

| Control | Behavior |
|---------|----------|
| **Geography** | Site/API edge allows **United States + Canada only**. Other countries get 403. |
| **VPN** | **Not required** for site access. Anonymous/VPN/proxy traffic is **monitored (Count)**, not blocked at the edge. |
| **Agency networks** | Optional IP allowlist bypass for agencies that need a fixed network path (“VPN / known office as needed”). Not a global gate. |
| **Auth** | Cognito JWT still required for app/API — geo is not a substitute for login. |

## What shipped live

| Layer | Where | Status |
|-------|--------|--------|
| CloudFront CDN WAF | [`infra/web-ssr-infra-template.yaml`](../../../infra/web-ssr-infra-template.yaml) `CdnWebAcl` | **Live on** `app.rapidcortex.us` |
| Regional API WAF | `infra/nested/stack-app-sam{,-2,-3,-4,-5}.yaml` `ApiWebAcl` | Templates aligned — apply on next healthy API stack deploy |
| Lambda REQUEST authorizer | `rc-lambda-authorizer-security.ts` | **Reference only** — APIs keep Cognito JWT authorizer |
| Standalone CFN + deploy script | `rc-security-hardening.yaml`, `deploy-security-hardening.sh` | **Not used** — provenance / future Bot Control + GuardDuty ideas |

## CDN rule order (prod)

1. Allow known agency IPs (`AgencyAllowlistCIDRs`) — optional bypass
2. **Geo-restrict to US + CA** (block)
3. Anonymous IP list (VPN/Tor/hosting) — **Count** (observe only; does not gate the site)
4. Common rule set — **`SizeRestrictions_BODY` = Count**
5. Known bad inputs
6. Amazon IP reputation
7. Per-IP rate limit

**Bot Control** is deferred (paid managed rule).

## Ops knobs

```bash
# scripts/env-web-ssr-prod.sh
export AGENCY_CIDRS="203.0.113.0/32"          # only when an agency needs network bypass
export WAF_SECURITY_ALERT_EMAIL="security@…"  # confirm SNS subscription email
export WAF_RATE_LIMIT_5M=2000
```

Deploy CDN ACL only:

```bash
source scripts/env-web-ssr-prod.sh
bash scripts/deploy-web-ssr.sh
```

Stack name in prod env: `rapid-cortex-web-ssr-prod-v2` (`APP_NAME=rapid-cortex-v2`).

## Deploy / live status (prod)

**Live CDN ACL** `rapid-cortex-v2-web-cdn-prod`: US/CA geo block + anonymous/VPN Count mode.

Full `deploy-web-ssr.sh` CFN update may still be blocked on ALB IAM (`ModifyLoadBalancerAttributes`). Until CFN owns the ACL again, surgical `aws wafv2 update-web-acl` keeps live rules aligned with this doc.
