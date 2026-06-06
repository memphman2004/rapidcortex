# Generic Webhook + Rapid Cortex Integration Guide

**Version 1.0** | Rapid Cortex Public Safety AI Platform

---

## Overview

Use this guide when your CAD or **middleware** can issue **HTTPS POST** requests with **JSON** (or JSON produced from XML upstream), but there is **no named vendor profile** in Rapid Cortex—or you prefer explicit **field mapping** control.

**What this integration does**

- Accepts a **generic JSON** body at the Rapid Cortex webhook endpoint.
- Maps your CAD’s field names to Rapid Cortex fields using **configuration** stored with the integration (`fieldMapping` / similar, per your Rapid Cortex build).
- Supports **agency-owned** transformation layers (ESB, iPaaS, scripts) between CAD and Rapid Cortex.

**Data flow (ASCII)**

```
┌──────────────┐     optional      ┌─────────────┐   HTTPS JSON    ┌──────────────────┐
│ Any CAD       │ ──► transformer │ (optional)  │ ──────────────► │ Rapid Cortex API │
└──────────────┘                   └─────────────┘                 └──────────────────┘
```

**Prerequisites**

- Ability to send **POST** with **TLS 1.2+**.
- Ability to set a **static secret** header (recommended: `X-RC-Token`).
- Rapid Cortex **admin** to configure mapping.

**Estimated setup time:** 1–3 hours **plus** mapping and testing.

---

## Prerequisites checklist

- [ ] Rapid Cortex **Admin** access.
- [ ] Sample **JSON** payload from CAD or middleware (sanitized).
- [ ] Mapping table agreed with dispatch / records.
- [ ] Outbound **443** to `api.rapidcortex.us`.

---

## Step 1: Generate integration credentials in Rapid Cortex

1. **Admin → CAD Integrations → Add integration**.
2. Choose **Generic webhook** (or equivalent).
3. Save and copy:
   - **Webhook URL:** `https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}`
   - **Token** (store in vault).

> ⚠️ **Critical:** Anyone with the URL **and** token can post data into your tenant path—**rotate** if leaked.

---

## Step 2: Configure your CAD or middleware

1. Configure **POST** to the webhook URL.
2. Set header: `X-RC-Token: <your token>` (unless your admin UI specifies a different header).
3. Ensure **Content-Type: application/json**.
4. In Rapid Cortex, configure **field mappings** so keys like your `IncidentId` map to Rapid Cortex’s expected logical fields (per admin UI / documentation).

> 💡 **Tip:** Keep payloads **stable**—avoid adding/removing keys without versioning your mapping.

---

## Step 3: Firewall / network configuration

Allow **HTTPS** to `api.rapidcortex.us`. Use AWS **API Gateway** IP guidance: [AWS IP address ranges](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html).

---

## Step 4: Test the connection

**curl example (replace placeholders)**

```bash
curl -sS -X POST \
  "https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}" \
  -H "X-RC-Token: {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "cadNumber": "TEST-001",
    "incidentType": "TEST CALL",
    "priority": "P3",
    "location": "123 MAIN ST",
    "callerCallback": "5550100",
    "callerName": "TEST USER",
    "units": ["U1","U2"]
  }'
```

> 💡 **Tip:** Expect HTTP **200** with a small JSON body; use Rapid Cortex **logs** to confirm parse success.

---

## Step 5: Validate data mapping

| Your JSON key (example) | Rapid Cortex logical field |
| --- | --- |
| `cadNumber` / `IncidentId` | CAD incident identifier |
| `incidentType` / `Nature` | Type / nature |
| `priority` | P1–P4 or mapped urgency |
| `location` | Address |
| `callerCallback` | Callback (CJI) |
| `callerName` | Caller (CJI) |
| `units` | Array of unit IDs |

---

## Step 6: Go live

- [ ] Dry-run with training CAD or test partition.
- [ ] Production enablement with rollback (disable POST).

---

## Troubleshooting

| Issue | Likely cause | Fix |
| --- | --- | --- |
| 401 | Token/header | Fix header name/value |
| 422 / rejected body | Mapping / schema | Adjust mapping; verify required keys |
| Partial data | Optional fields omitted | Expand CAD export |

---

## Data security & compliance

Minimum TLS 1.2, **no cross-agency** mixing of URLs/tokens, **audit** access, **CJI** handling for payloads.

---

## Support contacts

- **Rapid Cortex:** [support@rapidcortex.us](mailto:support@rapidcortex.us)

---

## Appendix A: Minimal JSON test payload

```json
{
  "cadNumber": "TEST-001",
  "incidentType": "TEST",
  "priority": "P3",
  "location": "123 MAIN ST",
  "units": []
}
```

---

## Appendix B: Field mapping reference (conceptual)

| Rapid Cortex logical | Typical CAD sources |
| --- | --- |
| CAD incident id | `IncidentNumber`, `CallId`, `CADCallNumber`, … |
| Type / nature | `NatureCode`, `CallType`, … |
| Priority | `Priority`, `PriorityCode`, … |
| Location | `Location`, `Address`, … |
| Callback / name | `CallbackNumber`, `CallerName`, … |
| Units | `Units`, `UnitList`, … |

---

## Appendix C: Compliance notes

Document who can change **mappings** and **tokens**. Generic integrations increase **human error** risk—use **peer review** for mapping changes.
