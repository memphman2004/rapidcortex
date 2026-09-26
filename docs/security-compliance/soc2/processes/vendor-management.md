# SOP — Vendor / subprocessor review

**TSC:** CC9.1  
**Policy:** [POL-05](../policies/05-vendor-management-policy.md)

## Quarterly

1. Diff [SUBPROCESSOR_LIST.md](../../SUBPROCESSOR_LIST.md) against:
   - Enabled feature flags on live (`WyzeEnabled`, Nest, Ring, external AI ARNs).
   - Secret **names** from the observation pack (not values).
2. Confirm each default-on AWS service is still required.
3. Confirm optional vendors with populated ARNs have a DPA or AWS artifact note off-git.
4. Record the review in [vendor-review-log.md](../evidence/vendor-review-log.md).
5. If a vendor should be off for CJIS-sensitive tenants, verify those ARNs are unset for those agencies.

Do not send marketing or “inquiry” email from this SOP. Vendor emails for C2C remain templates only.
