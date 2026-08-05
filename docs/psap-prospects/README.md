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

```bash
PSAP_PROSPECTS_TABLE=rapid-cortex-psap-prospects-dev \
  npx tsx scripts/enrich-psap-addresses.ts --state TX --limit 100
```

Nominatim (~1.1s delay). Checkpoint file: `.psap-enrich.checkpoint`. Addresses are `verified: false` until manually confirmed.

## Export

CSV via `GET /api/rc-admin/psap-prospects/export` (rcsuperadmin/rcadmin only). UI Export button preserves Content-Disposition through the BFF.
