# Rapid Cortex C2C Hub

NENA EIDO CAD-to-CAD hub for Rapid Cortex. This is **not** a CAD of record and **not** an ESInet / 5-nines C2C product.

Live partner CAD writes stay **fail-closed** (`CAD_WRITEBACK_ENABLED=false`) until the CAD write-back addendum and vendor UAT.

## What is live

Eight CAD slots (`CAD_A`–`CAD_H`) per Rapid Cortex agency:

| Slot | Default vendor |
|---|---|
| CAD_A / CAD_B | Southern Software |
| CAD_C / CAD_D | CentralSquare |
| CAD_E | Motorola |
| CAD_F | Tyler |
| CAD_G | Hexagon |
| CAD_H | Spillman |

Each slot has independent **on**, **inbound**, and **outbound** toggles (`GET/PATCH /api/c2c/slots`). Inbound defaults on; outbound defaults off.

## What you add later (outside Rapid Cortex)

1. **Secrets Manager JSON** at `rapid-cortex/c2c/{agencyId}/cad-a` … `cad-h`:

```json
{
  "baseUrl": "https://vendor-cad.example/api/",
  "apiKey": "",
  "clientId": "",
  "clientSecret": "",
  "authTokenUrl": "",
  "webhookSecret": "hmac-shared-secret",
  "agencyCode": "AGENCY"
}
```

Use `apiKey` **or** OAuth (`clientId` + `clientSecret` + `authTokenUrl`). Until `baseUrl` is an `https` URL, the slot health is `UNKNOWN` and no vendor HTTP runs.

2. **Vendor webhook** `POST` to:

`https://app.rapidcortex.us/api/public/c2c/{agencyId}/cad-a/events`

(and `cad-b` … `cad-h`). Sign the raw body with HMAC-SHA256 in `x-cad-signature` (or the vendor-specific `x-*-signature` header).

Admin UI: `/{jurisdiction}/admin/cad/c2c`.

## Paths

| Path | Purpose |
|---|---|
| `apps/api/src/c2c/` | EIDO, adapters, transfer rules, hub router |
| `apps/api/src/handlers/c2c/http.ts` | JWT `/api/c2c/*` (slots, health, incidents) |
| `apps/api/src/handlers/c2c/webhook.ts` | Public HMAC webhooks |
| `infra/nested/stack-app-sam-c2c.yaml` | Nested SAM (tables, KMS, SQS, Lambdas, 8 webhook routes) |
| `docs/c2c/SOUTHERN_SOFTWARE_API_SPEC.md` | Vendor ask for Berkeley / Dorchester |
| `docs/c2c/CENTRALSQUARE_API_SPEC.md` | Vendor ask for Charleston County |
