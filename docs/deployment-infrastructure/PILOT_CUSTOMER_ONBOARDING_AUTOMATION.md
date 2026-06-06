# Pilot Customer Onboarding Automation (Staging)

This runbook automates:

1. Create pilot customer agency in staging
2. Configure customer settings
3. Create dispatcher/supervisor/admin test accounts
4. Run CAD smoke checks (optional)
5. Validate role-based access using customer org roles
6. Run expected call-volume smoke probe

## Command

```bash
npm run onboard:pilot-customer
```

## Required environment variables

```bash
export AWS_REGION=us-east-1
export STAGE=staging

export PILOT_SUPERADMIN_USERNAME="superadmin@example.com"
export PILOT_SUPERADMIN_PASSWORD="<superadmin-password>"

export PILOT_AGENCY_CREATE_JSON='{
  "agencyId":"columbus-ga",
  "name":"Columbus 911",
  "type":"pilot",
  "state":"GA",
  "region":"Muscogee",
  "primaryContactName":"Ops Lead",
  "primaryContactEmail":"opslead@example.gov",
  "deploymentMode":"partially_integrated",
  "protocolPackId":"ga-default",
  "retentionPolicyId":"default-365",
  "integrationMode":"cad_read_only"
}'

export PILOT_AGENCY_PATCH_JSON='{
  "status":"pilot",
  "integrationMode":"cad_read_only"
}'

export PILOT_CUSTOMER_USERS_JSON='[
  {"email":"dispatcher.columbus@example.gov","role":"dispatcher","temporaryPassword":"TempPass!2026A"},
  {"email":"supervisor.columbus@example.gov","role":"supervisor","temporaryPassword":"TempPass!2026B"},
  {"email":"admin.columbus@example.gov","role":"admin","temporaryPassword":"TempPass!2026C"}
]'
```

## Optional controls

```bash
# Validate pipeline without creating/updating data
export DRY_RUN=true

# Run CAD smoke checks after provisioning
export PILOT_CAD_SMOKE=true

# Load smoke (health endpoint parallel checks)
export PILOT_EXPECTED_CALL_VOLUME=500
export PILOT_LOAD_CONCURRENCY=30
```

## Notes

- Uses staging stack outputs (`HttpApiUrl`, `UserPoolClientId`) from CloudFormation.
- Uses Cognito user-password auth to obtain ID tokens for API calls.
- Expects superadmin permissions for agency + admin user creation APIs.
- CAD write-back remains blocked by design; CAD smoke is read-only.
