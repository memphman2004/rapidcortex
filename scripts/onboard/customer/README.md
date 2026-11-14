# NexCort iQ — Vertical Onboarding Scripts

Day-0 tenant provision for every product vertical. One script run provisions:
Cognito groups, the agency row, the vertical config stub, and the ordered day-one seat pack.

---

## Quick start

```bash
# 1. Load AWS credentials for the target stage
source scripts/env-api-dev.sh          # or env-api-staging.sh

# 2. Copy the env example for your vertical and fill it in
cp scripts/onboard/vars/campus.env.example scripts/onboard/vars/campus.env
# (never commit *.env files — they contain passwords)

# 3. Set a strong password meeting pool policy
#    12+ chars, upper, lower, digit, symbol
export ONBOARD_ADMIN_PASSWORD="Str0ng!Pass1234"

# 4. Run (dry-run first)
DRY_RUN=1 bash scripts/onboard/campus.sh scripts/onboard/vars/campus.env
bash scripts/onboard/campus.sh scripts/onboard/vars/campus.env
```

---

## Available verticals

| npm script | Shell shortcut | Env example |
|---|---|---|
| `npm run onboard:campus` | `bash scripts/onboard/campus.sh` | `vars/campus.env.example` |
| `npm run onboard:venue` | `bash scripts/onboard/venue.sh` | `vars/venue.env.example` |
| `npm run onboard:transit` | `bash scripts/onboard/transit.sh` | `vars/transit.env.example` |
| `npm run onboard:hospital` | `bash scripts/onboard/hospital.sh` | `vars/hospital.env.example` |
| `npm run onboard:psap` | `bash scripts/onboard/psap.sh` | `vars/psap.env.example` |
| `npm run onboard:call-assist` | `bash scripts/onboard/call-assist.sh` | `vars/call-assist.env.example` |

---

## Day-one seat order

Seats are provisioned in this order. The admin seat is always required; floor-role seats are
provisioned only when the corresponding `*_EMAIL` env var is non-empty.

| Vertical | Seat order |
|---|---|
| **PSAP** | agencyadmin → agencyit → supervisor → dispatcher → analyst → auditor |
| **Campus** | campus_admin_\{type\} → campus_supervisor_\{type\} → campus_security_\{type\} → campus_dispatch_\{type\} |
| **Venue** | venue_admin → venue_supervisor → venue_security → venue_operator → venue_guest |
| **Transit** | transit_admin → transit_supervisor → transit_security → transit_operator |
| **Hospital** | hospitaladmin → hospital_coord → hospitalstaff |
| **Call Assist** | call_assist_admin → call_assist_supervisor → call_assist_operator |

For campus, set `CAMPUS_INSTITUTION_TYPE=k12` or `highered` (default: `highered`).
The role suffix and Cognito group name change accordingly.

---

## Human-gate steps (not automated)

These steps require human action **after** the script runs. The script prints a "later" checklist at the end.

| Step | Vertical | Why it's a gate |
|---|---|---|
| Rotate all day-one passwords and enforce MFA | All | Security posture before go-live |
| Invite remaining staff via EXTRA_USERS_JSON | All | Beyond the seed seats |
| SSO / IdP metadata | All | Requires customer IdP config |
| SMS origination (10DLC/TFN) | All | Dedicated number required — never share +13198358230 |
| CAD write-back signed addendum | PSAP | Fail-closed until signed |
| Load buildings CSV | Campus | Customer-supplied floor plan |
| Load zones CSV | Venue | Customer-supplied zone map |
| Load fleet / routes | Transit | Do not copy Hoover Valley demo data |
| Capacity board training | Hospital | No EHR/HL7 in this script |
| PSAP workbook | PSAP | Protocol pack, ALI source, Transcribe vocab |
| Lex / Connect provision | Call Assist | POST /api/call-assist/onboarding after day-0 |
| DID routing | Call Assist | POST /api/call-assist/did after dedicated number registered |

---

## Extra users

Add extra seats beyond the ordered pack without modifying the env file:

```bash
export EXTRA_USERS_JSON='[
  {"email":"floor-lead@example.com","role":"venue_security"},
  {"email":"ops@example.com","role":"venue_operator"}
]'
```

Extra users receive their role group and the vertical marker group only.
They do not receive admin groups.

---

## Agency-scoping

`agencyId` is always taken from the env file (or auto-generated). It is **never** derived from
a URL parameter. All DynamoDB writes are tenant-scoped.

---

## Password policy

The pool requires 12+ characters with upper, lower, digit, and symbol.
`ONBOARD_ADMIN_PASSWORD` is validated before any AWS call and is never logged.

---

## What this script does NOT do

- Does not enable CAD write-back
- Does not configure SSO
- Does not register SMS origination
- Does not provision Lex / Amazon Connect (Call Assist)
- Does not load buildings, zones, fleet, or routes
- Does not send welcome emails (message action is SUPPRESS)
