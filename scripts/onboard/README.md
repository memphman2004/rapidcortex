# Vertical day-0 onboarding

Fill an env file with the agency’s identity, then run the matching script. Buildings, zones, fleet, SSO, SMS numbers, and CAD stay **out** of day-0 so you can stand up a tenant before the customer finishes their spreadsheet.

CAD write-back is refused (`INTEGRATION_MODE=bidirectional` exits). SMS origination is not written here — use `scripts/seed-sms-routing-dev.sh` only with a number that belongs to that agency.

## Day 0

```bash
source scripts/env-api-dev.sh          # COGNITO_USER_POOL_ID, AWS creds, stage
cp scripts/onboard/vars/campus.env.example scripts/onboard/vars/campus.env
# edit campus.env — name, agency id, admin email, password
DRY_RUN=1 bash scripts/onboard/campus.sh scripts/onboard/vars/campus.env
bash scripts/onboard/campus.sh scripts/onboard/vars/campus.env
```

Same pattern for `venue.sh`, `transit.sh`, `hospital.sh`, `psap.sh`.

Or:

```bash
VERTICAL=campus npx tsx scripts/onboard/onboard-agency.ts
```

| Script | Creates |
|---|---|
| Agency row | `agencyId`, vertical, type, contacts, `integrationMode` (never bidirectional), network policy |
| Cognito | Vertical groups + first admin (`campus_admin` / `venue_admin` / `transit_admin` / `hospitaladmin` / `agencyadmin`) |
| Campus | `SETTINGS` + `SITES` stub — **no** UGA demo buildings |
| Venue | `CONFIG` stub — **no** MBS gates |
| Transit | `CONFIG#org` stub — **no** Hoover Valley fleet |
| Hospital | Agency + `custom:hospitalId` on the admin |
| PSAP | Agency (`vertical=core`) + agency admin |

Optional in the env file:

- `SEED_BILLING=1` — billing customer stub
- `SEED_PLACEHOLDER_QR=1` — one dummy QR (prefer the CSV loader instead)
- `EXTRA_USERS_JSON='[{"email":"a@x.edu","role":"campus_security"}]'`
- `DRY_RUN=1` — print the plan, no writes

Passwords are never logged. `*.env` copies are gitignored.

## Later (agency spreadsheet)

```bash
export CAMPUS_CODE=UGA AGENCY_ID=uga-athens-safety
export CAMPUS_CONFIG_TABLE=rapid-cortex-campus-config-dev
npx tsx scripts/onboard/load-campus-buildings.ts --file scripts/onboard/templates/campus-buildings.csv

export VENUE_CODE=MBS AGENCY_ID=atl-mbs-ops
export VENUE_CONFIG_TABLE=rapid-cortex-venue-config-dev
npx tsx scripts/onboard/load-venue-zones.ts --file scripts/onboard/templates/venue-zones.csv

export AGENCY_ID=uga-athens-safety AGENCY_NAME="…" VERTICAL=campus
export QR_NFC_CODES_TABLE=rapid-cortex-qr-nfc-codes-dev
npx tsx scripts/onboard/load-qr-codes.ts --file scripts/onboard/templates/qr-codes.csv
```

CSV templates are in `scripts/onboard/templates/`.

## Still human gates (do not script)

- SSO / IdP metadata
- Dedicated SMS origination identity (do not reuse `+13198358230` on a second tenant)
- CAD read-only vs write-back addendum
- Clery / lockdown / Guest Services acknowledgements (in-app campus & venue intake)
- Protocol pack sign-off (PSAP)

## Not this folder

Demo fixtures stay where they are: `seed-campus-test-agency.ts` (UGA), `seed-venue-config-mbs.ts`, `seed-transit-test-agency.ts`, `onboard-pilot-customer.ts` (staging PSAP API flow). Do not run those against a real customer tenant.
