# Hexagon (HxGN OnCall / I/CAD) + Rapid Cortex Integration Guide

**Version 1.0** | Rapid Cortex Public Safety AI Platform

---

## Overview

This guide targets **Hexagon Safety & Infrastructure** dispatch products commonly known as **HxGN OnCall Dispatch** or legacy **Intergraph I/CAD**. Payloads may be **XML** or **JSON** depending on version and interface pack.

**What this integration does**

- Sends incident and related updates to Rapid Cortex for supplemental AI and workspace features.
- Preserves **CAD as system of record**; Rapid Cortex does not replace dispatch functions in Hexagon.

**Data flow (ASCII)**

```
┌─────────────────────┐  HTTPS (XML or JSON)  ┌──────────────────────┐
│ Hexagon / I-CAD      │ ────────────────────► │ api.rapidcortex.us    │
│ Integration Manager  │  + API key / WS-Sec   │ /api/cad/webhook/...  │
└─────────────────────┘                        └──────────┬──────────┘
                                                            ▼
                                                     Normalize → store
```

**Prerequisites**

- **HxGN OnCall Dispatch / I/CAD 9.0+** (confirm exact release with Hexagon).
- Access to **Integration Manager** or equivalent **outbound interface** configuration.
- Rapid Cortex **admin** credentials.
- Outbound **HTTPS**.

**Estimated setup time:** 2–6 hours (longer if XML transforms or ESB in path).

**Who should be involved**

| Role | Responsibility |
| --- | --- |
| Hexagon PS / support | Interface enablement, schema |
| Agency IT | TLS, proxies, certificates |
| Rapid Cortex admin | Integration + testing |

---

## Prerequisites checklist

- [ ] Rapid Cortex **Admin** access.
- [ ] Hexagon product **version** recorded.
- [ ] **Integration Manager** (or equivalent) access.
- [ ] Outbound **443** to `api.rapidcortex.us`.
- [ ] If **WS-Security** is required, coordinate certificate lifecycle (expiry alerts).

---

## Step 1: Generate integration credentials in Rapid Cortex

1. **Admin → CAD Integrations → Add integration**.
2. Select **Hexagon** (or **Hexagon / Intergraph** if shown).
3. Copy **webhook URL** and **token** / API secret per UI.

> ⚠️ **Critical:** Store tokens in a vault; rotate on staff changes.

---

## Step 2: Configure Hexagon / I/CAD

**Typical path**

1. **System Configuration → Integration Manager → Outbound Interfaces** (labels vary).
2. **New HTTP(S) outbound** interface:
   - **URL:** `https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}`
   - **Method:** `POST`
   - **Payload:** JSON *or* XML per your agreement with Rapid Cortex (middleware may convert XML→JSON).
3. **Authentication**
   - **API key** header, **Bearer**, or **WS-Security** per Hexagon module — **must match** what Rapid Cortex expects for your integration type.
4. Select **events:** incident create/update/close; unit status if available.
5. **Save** and run Hexagon’s **connectivity test** if available.

> 💡 **Tip:** If Rapid Cortex requires JSON but Hexagon emits XML only, deploy a small **agency-owned transformer** with change control and monitoring.

---

## Step 3: Firewall / network configuration

Allow **HTTPS** to `api.rapidcortex.us`. IP ranges are dynamic; use [AWS IP address ranges](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html) for **API Gateway**.

---

## Step 4: Test the connection

Use Rapid Cortex **Send test incident** and Hexagon’s test tools; reconcile timestamps and incident IDs in logs.

---

## Step 5: Validate data mapping

| Hexagon / I/CAD (examples) | Rapid Cortex |
| --- | --- |
| Incident / call identifier | `cadIncidentId` |
| Nature / type text | Nature / type |
| Priority | Priority mapping |
| Address / location string | `cadLocation` |
| Caller phone / name | CJI fields |
| Units | `cadUnits` |
| Lat/lon | `cadCoordinates` |
| CAD status | `cadStatus` |

---

## Step 6: Go live

- [ ] Parallel run with dispatcher QA.
- [ ] Rollback plan documented (disable outbound interface).

---

## Troubleshooting

| Issue | Likely cause | Fix |
| --- | --- | --- |
| Signature / auth failures | Wrong scheme | Align WS-Security vs simple header with support |
| Payload rejected | Schema mismatch | Add transformer or adjust mapping |
| Timeouts | Payload size | Reduce optional fields; batch if needed per policy |

---

## Data security & compliance

TLS 1.2+, encryption at rest, **tenant isolation**, **audit**. Treat as **CJI**.

---

## Support contacts

| Channel | Detail |
| --- | --- |
| Rapid Cortex | [support@rapidcortex.us](mailto:support@rapidcortex.us) |
| Hexagon Safety & Infrastructure | Use your **Hexagon support contract** portal / TAM. |

---

## Appendix A: Sample JSON payload (illustrative)

```json
{
  "IncidentNumber": "HX-99231",
  "EventType": "IncidentUpdate",
  "NatureCode": "MEDICAL EMERGENCY",
  "Priority": "1",
  "Location": "900 OAK AVE",
  "IncidentStatus": "DISPATCHED",
  "Units": ["M7", "M2"],
  "Latitude": 33.7490,
  "Longitude": -84.3880
}
```

---

## Appendix B: Field mapping reference

| Source field (examples) | Rapid Cortex |
| --- | --- |
| `IncidentNumber` | CAD incident id |
| `NatureCode` / incident type | Nature / type |
| `Priority` | CAD priority |
| `Location` | CAD location |
| `IncidentStatus` | CAD status |
| `Units[]` | Assigned units |
| `Latitude` / `Longitude` | Coordinates |

---

## Appendix C: Compliance notes

Document XML/JSON handling, **certificate** lifecycle for WS-Security, and any **middleware** in your authorization boundary.
