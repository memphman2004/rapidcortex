# Employee Onboarding — RC Internal Staff

Provisions NexCort iQ platform team accounts in the Cognito User Pool.

---

## Scripts

| Script | Purpose |
|---|---|
| `provision-rc-staff.ts` | Provision all 3 RC internal roles in one run (canonical) |
| `create-rc-admin.ts` | Legacy: provision `rcsuperadmin` only |
| `seed-role-test-users.ts` | Seed QA + App Store review test accounts (all verticals) |

---

## Provision RC staff (production)

```bash
source scripts/env-api-dev.sh

export RC_STAFF_TEMP_PASSWORD="Str0ng!Pass1234"   # 12+ chars, U+L+N+symbol — never logged

# Required: RC Super Admin
export RC_SUPERADMIN_EMAIL=Support@appsondemand.net

# Optional: provision additional RC internal roles
export RC_ADMIN_EMAIL=rcadmin@appsondemand.net
export RC_ITADMIN_EMAIL=rcitadmin@appsondemand.net

npm run seed:rc-staff
# or: npx tsx scripts/onboard/employee/provision-rc-staff.ts
```

**To reset passwords** (force-sets even if users exist):
```bash
RESET_RC_STAFF_PASSWORD=true npm run seed:rc-staff
```

---

## RC role matrix

| Role | Cognito group | agencyId | Access |
|---|---|---|---|
| `rcsuperadmin` | `rcsuperadmin` | `__platform__` | Full platform — all agencies |
| `rcadmin` | `rcadmin` | `__platform__` | Platform admin — no billing/IAM |
| `rcitadmin` | `rcitadmin` | `__platform__` | Platform IT / infrastructure |

All three land at `/rc-admin/dashboard` or `/rc-admin/infrastructure` (rcitadmin).

---

## Seed test accounts (dev / staging)

Seeds one test account per role across all verticals + App Store review accounts:

```bash
source scripts/env-api-dev.sh
export RAPID_CORTEX_TEST_TEMP_PASSWORD="Str0ng!Pass1234"
npm run seed:role-test-users

# To reset all test passwords:
RESET_RAPID_CORTEX_TEST_PASSWORDS=true npm run seed:role-test-users
```

**Test agencies used:**

| Test agency | Vertical |
|---|---|
| `__platform__` | RC internal (`rcsuperadmin`, `rcadmin`, `rcitadmin`) |
| `test-agency` | PSAP dispatcher / supervisor / admin / analyst / auditor |
| `test-campus-uga` | Campus (highered) |
| `test-venue-mbs` | Venue |
| `test-transit-hvt` | Transit |
| `test-hospital-grady` | Hospital |
| `test-call-assist-example` | Call Assist (Nexiq) |

---

## Password policy

Cognito pool requires: 12+ characters with upper, lower, digit, and symbol.
Passwords are **never logged**. Rotate before go-live and enforce MFA enroll.
