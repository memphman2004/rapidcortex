# PSAP Prospect CRM

National outbound prospect database for US PSAPs (Public Safety Answering Points), separate from inbound **Leads CRM**.

## Access

- Roles: `rcsuperadmin` | `rcadmin` | `rcitadmin` (`canAccessRcFinancePortal`)
- UI flag: `NEXT_PUBLIC_ENABLE_PSAP_PROSPECTS` (default **on** when unset)
- Nav: RC Admin → Business → **PSAP Prospects** (`/rc-admin/psap-prospects`)

## Stack

- DynamoDB: `PsapProspectsTable` (DataLayer) — GSIs `StateUpdatedIndex`, `StatusUpdatedIndex`, `PhoneIndex`
- API: surgical nested stack `AppSamPsapCrmStack` → `infra/nested/stack-app-sam-3-psap-crm.yaml` (wired from `infra/template.yaml`, DependsOn `AppSam3Stack`)
- Routes under `/api/rc-admin/psap-prospects/*` on AppSam3 HttpApi
- Web BFF mirrors those paths under `apps/web/app/api/rc-admin/psap-prospects/`

## Seed

```bash
PSAP_PROSPECTS_TABLE=rapid-cortex-psap-prospects-dev \
  npx tsx scripts/seed-psap-prospects.ts ./rc-psap-with-coordinates.xlsx
```

Requires `xlsx` (`npm i -D xlsx`). Dedupes by phone via `PhoneIndex`.

## Address enrichment

Uses **AWS Location Service (Esri)** — reverse geocode when `latitude`/`longitude` exist, otherwise forward geocode from name + city/county + state. Writes nested `mailingAddress` (`source: aws_location`, `verified: false` until manually confirmed). Idempotent: skips records that already have `mailingAddress.streetAddress` unless `--force`.

```bash
# Optional one-time place index (script also creates it if missing)
aws cloudformation deploy \
  --template-file infra/nested/psap-enrichment-place-index.yaml \
  --stack-name rapid-cortex-psap-enrichment-dev \
  --parameter-overrides Stage=dev

# Dry run (no writes; still needs DescribePlaceIndex if index exists)
STAGE=dev npx tsx scripts/enrich-psap-addresses.ts --dry-run

# Smoke: one state, capped
STAGE=dev npx tsx scripts/enrich-psap-addresses.ts --state=GA --limit=50

# Full run (~$2.80 one-time at Esri list price for ~5.6k lookups)
STAGE=dev npx tsx scripts/enrich-psap-addresses.ts
```

Env overrides: `PSAP_PROSPECTS_TABLE`, `PSAP_PLACE_INDEX`, `AWS_REGION`. IAM needs DynamoDB Scan/Query/UpdateItem on the prospects table and `geo:SearchPlaceIndexFor*` / `DescribePlaceIndex` (plus `CreatePlaceIndex` if not deploying the nested template first).

**Deploy IAM:** `rapid-cortex-deploy` needs Location (`geo:*`) actions — added to [`infra/iam/sam-deploy-policy.prod.json`](../../infra/iam/sam-deploy-policy.prod.json) as `PsapAddressEnrichmentLocation*`. Apply with an admin profile:

```bash
ADMIN_AWS_PROFILE=<admin> ./scripts/apply-sam-deploy-managed-policies.sh
# or recreate/update the managed policy that includes sam-deploy-policy.prod.json
```

Until that policy is attached, place-index CFN deploy and enrichment will fail with `AccessDenied` on `geo:*`.

## Export

CSV via `GET /api/rc-admin/psap-prospects/export` (rcsuperadmin/rcadmin only). UI Export button preserves Content-Disposition through the BFF.
