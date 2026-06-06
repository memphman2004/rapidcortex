# CentralSquare CAD + Rapid Cortex Integration Guide

**Version 1.0** | Rapid Cortex Public Safety AI Platform

---

## Overview

This guide applies to **CentralSquare CAD** and related product lines historically marketed as **Tritech**, **Superion**, or **Zuercher**. Menu labels differ by release; validate against your installed version.

**What this integration does**

- Delivers CAD incident and update events to Rapid Cortex over **HTTPS** (typically **JSON**).
- Enables Rapid Cortex to display CAD-sourced fields and optional AI overlays while **CAD remains authoritative**.

**Data flow (ASCII)**

```
┌────────────────────┐   HTTPS POST (JSON)   ┌──────────────────────┐
│ CentralSquare CAD   │ ───────────────────► │ api.rapidcortex.us    │
│ (admin configured)  │   + API key / token  │ /api/cad/webhook/...  │
└────────────────────┘                       └──────────┬──────────┘
                                                          ▼
                                                   Parse → incident update
```

**Prerequisites**

- Supported CentralSquare CAD release (confirm with CentralSquare for your **build** and **interface** modules).
- CAD **admin** access to **External interfaces** / webhooks.
- Rapid Cortex **admin** for credentials.
- Outbound **HTTPS** to Rapid Cortex.

**Estimated setup time:** 2–4 hours.

**Who should be involved**

| Role | Responsibility |
| --- | --- |
| Agency IT | Firewall, secrets, change windows |
| CAD admin | Webhook configuration |
| Rapid Cortex admin | Integration + validation |
| CentralSquare support | Version-specific steps |

---

## Prerequisites checklist

- [ ] Rapid Cortex **Admin** access.
- [ ] CentralSquare CAD version documented.
- [ ] CAD admin credentials.
- [ ] Outbound **443** to `api.rapidcortex.us`.
- [ ] Optional: CentralSquare support case opened for **webhook** confirmation.

---

## Step 1: Generate integration credentials in Rapid Cortex

1. **https://www.rapidcortex.us** → **Admin → CAD Integrations**.
2. **Add integration** → **CentralSquare** (or **CentralSquare / Tritech** if shown).
3. Name (e.g. `CentralSquare Prod`).
4. Copy:
   - **Webhook URL:** `https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}`
   - **API key / token** as shown for your tenant (header name per UI).

> ⚠️ **Critical:** Save secrets in a vault; rotate if leaked.

---

## Step 2: Configure CentralSquare CAD

**Typical navigation**

1. **Administration → System Configuration → External Interfaces → REST Webhooks**  
   (On some builds: **Integrations → Outbound Webhooks**.)
2. **Add webhook**
   - **Endpoint URL:** Rapid Cortex webhook URL.
   - **Method:** `POST`
   - **Content-Type:** `application/json`
3. **Authentication**
   - Use **API key header** or **Bearer** as required by your Rapid Cortex integration screen (match header name exactly).
4. **Events** (recommended): CAD call/incident **added**, **updated**, **closed**; unit assignment updates if licensed.
5. **Save** and **Test**.

> 💡 **Tip:** If your build only supports a **generic HTTP client**, use the **Generic webhook** guide in addition to this one for field mapping.

---

## Step 3: Firewall / network configuration

| Host | Purpose |
| --- | --- |
| `api.rapidcortex.us` | Webhooks / API |
| `downloads.rapidcortex.us` | Client updates |

Use **AWS API Gateway** IP range guidance (dynamic): [AWS IP address ranges](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html).

---

## Step 4: Test the connection

1. Rapid Cortex **Send test incident**.
2. Validate in dispatcher UI and **webhook / raw log** views.

---

## Step 5: Validate data mapping

| CentralSquare (examples) | Rapid Cortex |
| --- | --- |
| `CallId` / `IncidentNumber` | CAD incident id |
| `NatureText` / `CallType` | Type / nature |
| `PriorityCode` | Priority mapping |
| `LocationText` | Address |
| `CallerPhone` | Callback (CJI) |
| `UnitIds` | Units |
| `Latitude` / `Longitude` | Coordinates |
| `IncidentStatus` | CAD status |

---

## Step 6: Go live

- [ ] Pilot incidents completed.
- [ ] Dispatcher sign-off.
- [ ] CAD remains **system of record**.

---

## Troubleshooting

| Issue | Likely cause | Fix |
| --- | --- | --- |
| 401 / 403 | Wrong API key / header | Re-copy secret; align header name |
| No payload | Event filter | Enable update + close events |
| SSL errors | Inspection | Corporate CA trust on publisher |

---

## Data security & compliance

TLS 1.2+, encryption at rest, **tenant isolation**, **audit** trails. Treat payloads as **CJI**.

---

## Support contacts

| Channel | Detail |
| --- | --- |
| Rapid Cortex | [support@rapidcortex.us](mailto:support@rapidcortex.us) |
| CentralSquare | Use your **CentralSquare support portal** / account team (URLs vary by contract). |

---

## Appendix A: Sample JSON payload (illustrative)

```json
{
  "incident_id": "CS-44102",
  "nature": "TRAFFIC STOP",
  "incident_type": "TRAFFIC",
  "priority": "3",
  "address": "I-55 NB @ MM 172",
  "callback": "5550177",
  "caller_name": "TROOPER",
  "assigned_units": ["221", "218"],
  "latitude": 41.8781,
  "longitude": -87.6298,
  "incident_status": "ACTIVE"
}
```

---

## Appendix B: Field mapping reference

| CAD field (examples) | Rapid Cortex |
| --- | --- |
| `incident_id` / `IncidentNumber` | CAD incident linkage |
| `nature` / `incident_type` | Nature / type |
| `priority` / `PriorityCode` | Priority |
| `address` / `LocationText` | Location |
| `callback` | Callback |
| `caller_name` | Caller |
| `assigned_units` | Units |
| Coordinates | `cadCoordinates` |

---

## Appendix C: Compliance notes

Include this integration in your **SSP**, **CJIS connectivity** package (if applicable), and **vendor risk** assessment for CentralSquare.
