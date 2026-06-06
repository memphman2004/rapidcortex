# Rapid Cortex HL7 Listener

Receives **HL7 v2 ADT** messages over **MLLP/TCP** (port 2575), aggregates occupied beds by department, and writes **`HospitalCapacity`** rows to DynamoDB (tenant-scoped `AGENCY#` / `CAPACITY#` keys — same shape as the API).

## Local development

```bash
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-hl7-listener

# Parse sample message only (no DynamoDB)
HL7_MOCK=true npm run dev -w rapid-cortex-hl7-listener

# Write to local/table (requires AWS creds + table)
HOSPITAL_CAPACITY_TABLE=rapid-cortex-hospital-capacity-dev HL7_MOCK=true npm run dev -w rapid-cortex-hl7-listener

# TCP listener
HOSPITAL_CAPACITY_TABLE=rapid-cortex-hospital-capacity-dev npm run start -w rapid-cortex-hl7-listener
```

## Facility mapping

Map hospital EMR sending facility codes to Rapid Cortex `agencyId` + `hospitalId`:

```bash
export HL7_FACILITY_MAP_JSON='{"SARASOTA_MEM":{"agencyId":"agency-1","hospitalId":"hosp-1","bedTotals":{"er":25,"icu":12,"trauma":4}}}'
```

See `config/facility-map.example.json`.

## Deploy

Build/push container image, then deploy `infra/nested/stack-hl7-listener.yaml` with:

- `HospitalCapacityTableName` — from stack 2 `HospitalCapacityTable`
- `Hl7ListenerImageUri` — ECR URI
- `Hl7FacilityMapJson` — production facility map
- Restrict `AllowedHospitalCidr` to hospital VPN/public IPs

## Mock / CI

Set `HL7_MOCK=true` to process a built-in ADT^A01 sample without opening TCP (used in CI and local dev without hospital connectivity).
