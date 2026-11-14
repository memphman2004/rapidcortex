# NexCort iQ — Onboarding Scripts

```
scripts/onboard/
├── customer/   Day-0 vertical tenant provisioning (agencies, seats, config stubs)
└── employee/   RC internal staff provisioning (rcsuperadmin, rcadmin, rcitadmin, test users)
```

---

## Customer onboarding → [`customer/`](customer/README.md)

Provisions a new vertical tenant: Cognito groups, agency row, vertical config stub,
and ordered day-one seat pack (admin → supervisor/IT → floor).

```bash
source scripts/env-api-dev.sh
cp scripts/onboard/customer/vars/campus.env.example scripts/onboard/customer/vars/campus.env
# fill in the env file, then:
bash scripts/onboard/customer/campus.sh scripts/onboard/customer/vars/campus.env
```

Verticals: `campus` · `venue` · `transit` · `hospital` · `psap` · `call_assist`

---

## Employee onboarding → [`employee/`](employee/README.md)

Provisions RC internal platform staff in Cognito.

```bash
source scripts/env-api-dev.sh
export RC_STAFF_TEMP_PASSWORD="Str0ng!Pass1234"
export RC_ADMIN_EMAIL=rcadmin@appsondemand.net
export RC_ITADMIN_EMAIL=rcitadmin@appsondemand.net
npm run seed:rc-staff
```

Also seeds QA + App Store review test accounts:
```bash
npm run seed:role-test-users
```
