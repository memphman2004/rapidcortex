# Tyler New World + Rapid Cortex Integration Guide

**Version 1.0** | Rapid Cortex Public Safety AI Platform

---

## Overview

This guide covers connecting **Tyler Technologies New World CAD** (and related Tyler public safety suites) to **Rapid Cortex** for secure incident and status delivery. Many Tyler deployments require **Tyler professional services** or support tickets to enable outbound HTTP or API features.

**What this integration does**

- Brings Tyler incident data into Rapid Cortex for AI-assisted workflows and dispatcher overlays.
- May use **HTTP push** (webhook-style) where enabled, or an **agency-managed poller** that reads Tyler’s CAD API and forwards normalized events to Rapid Cortex (architecture depends on your contract and Tyler’s supported interfaces).

**Data flow (ASCII)**

```
┌──────────────────┐   HTTPS (push or broker)   ┌──────────────────────┐
│ New World CAD     │ ────────────────────────► │ api.rapidcortex.us    │
│ or Tyler API      │   JSON + auth             │ /api/cad/webhook/...  │
│ (via PS / broker) │                           └──────────┬───────────┘
└──────────────────┘                                      ▼
                                                   Validate → parse → store
```

**Prerequisites**

- New World CAD **11.0+** (confirm with Tyler for your licensed modules).
- **Tyler support** or PS engagement is often **required** for interface work.
- Rapid Cortex **admin** for integration credentials.
- Outbound **HTTPS** from the integration host to Rapid Cortex.

**Estimated setup time:** **4–8 hours** (often multi-day if PS queue applies).

**Who should be involved**

| Role | Responsibility |
| --- | --- |
| Tyler Technologies support / PS | Enable API or HTTP push, confirm payload schema |
| Agency IT | Firewall, identity, secrets handling |
| Rapid Cortex admin | Integration lifecycle, testing, go-live |
| Compliance | CJIS / data flow sign-off |

---

## Prerequisites checklist

- [ ] Rapid Cortex **Admin** access.
- [ ] New World CAD **11.0+** documented in change record.
- [ ] **Tyler support ticket** opened (recommended template: “Outbound HTTPS incident feed to partner API”).
- [ ] CAD admin credentials for **Agency Setup** / interface areas.
- [ ] Outbound **443** allowed to `api.rapidcortex.us`.
- [ ] If using **polling**: host for poller identified (always-on VM/container).

---

## Step 1: Generate integration credentials in Rapid Cortex

1. Log in at **https://www.rapidcortex.us**.
2. **Admin → CAD Integrations**.
3. **Add integration** → select **Tyler New World**.
4. Name the connection (e.g. `New World — Prod`).
5. Save to generate:
   - **Webhook URL:** `https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}`
   - **Security token** (copy immediately).

> ⚠️ **Critical:** Store the token in a **vault**. Regenerate if exposed.

---

## Step 2: Configure Tyler New World CAD

> 💡 **Expect variability:** Tyler UI labels differ by version and licensed modules. Use Tyler’s documentation for your exact build.

**Typical path (HTTP push / notifications, where licensed):**

1. **System Setup → Agency Setup → Interface Configuration → HTTP Push Notifications** (or **External Interfaces** on some builds).
2. Create a **new outbound endpoint**:
   - **URL:** Rapid Cortex webhook from Step 1.
   - **Method:** `POST`
   - **Format:** `application/json`
3. **Authentication**
   - Preferred: **Bearer token** *or* **custom header** matching Rapid Cortex (e.g. `X-RC-Token: <token>`) per your Rapid Cortex admin panel instructions.
4. **Events:** incident create/update/close; unit status if available.
5. **Save** and run Tyler’s **test** tool if present.

**If HTTP push is not available**

- Work with Tyler to enable **CAD Query API** or supported export path.
- Place a **broker** in your DMZ that polls Tyler and `POST`s normalized JSON to Rapid Cortex (agency-owned component + change control).

---

## Step 3: Firewall / network configuration

| Host | Purpose |
| --- | --- |
| `api.rapidcortex.us` | Webhook / API traffic |
| `downloads.rapidcortex.us` | Client updates (separate from CAD feed) |

**IP ranges:** Use AWS published ranges for **API Gateway** in your region; do not rely on static lists in printouts. See [AWS IP address ranges](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html).

---

## Step 4: Test the connection

1. Rapid Cortex **Admin → CAD Integrations** → your integration → **Send test incident**.
2. Confirm receipt in **dispatcher workspace** and integration **logs**.
3. Optionally trigger a **sandbox incident** in Tyler training CAD.

---

## Step 5: Validate data mapping

| Tyler (example) | Rapid Cortex |
| --- | --- |
| `CADCallNumber` / call id | CAD incident linkage |
| `CallType` / `ProblemType` | Type / nature |
| `Priority` | Priority / urgency mapping |
| `FullAddress` | Location |
| `CallPhone` | Callback (CJI) |
| `CallerName` | Caller name (CJI) |
| `UnitList` | Units |
| `XCoordinate` / `YCoordinate` | Coordinates (projection as agreed with Tyler) |
| `CallStatus` | CAD status string |

---

## Step 6: Go live

- [ ] Tyler PS / support sign-off on payload stability.
- [ ] Pilot real incidents; compare CAD vs Rapid Cortex fields.
- [ ] Dispatcher briefing completed.

---

## Troubleshooting

| Issue | Likely cause | Fix |
| --- | --- | --- |
| Tyler cannot enable push | License / module | Open Tyler ticket; consider broker + API |
| 401 from Rapid Cortex | Token mismatch | Regenerate token; update Tyler header |
| Wrong coordinates | Projection / datum | Align with Tyler PS on CRS |
| Missing units | Event filter | Enable unit / assignment events |

---

## Data security & compliance

Same baseline as other guides: **TLS 1.2+**, encryption at rest in Rapid Cortex, **tenant isolation**, **audit logging**, treat payloads as **CJI**.

---

## Support contacts

| Channel | Detail |
| --- | --- |
| Rapid Cortex | [support@rapidcortex.us](mailto:support@rapidcortex.us) |
| Tyler public safety support | **publicsafety.support@tylertech.com** (confirm on [tylertech.com](https://www.tylertech.com/) for your region) |

---

## Appendix A: Sample JSON payload (illustrative)

```json
{
  "CADCallNumber": "NW-2025-88921",
  "CallType": "ALARM — COMMERCIAL",
  "ProblemType": "FIRE ALARM",
  "Priority": "2",
  "FullAddress": "500 COMMERCE BLVD, UNIT 12",
  "CallPhone": "5550199",
  "CallerName": "SITE CONTACT",
  "UnitList": ["E4", "E1"],
  "XCoordinate": -97.7431,
  "YCoordinate": 30.2672,
  "CallStatus": "ACTIVE"
}
```

---

## Appendix B: Field mapping reference

| Tyler field (examples) | Rapid Cortex usage |
| --- | --- |
| `CADCallNumber` | CAD incident id |
| `CallType` / `ProblemType` | Incident type / nature |
| `Priority` | Map to P1–P4 per agency table |
| `FullAddress` | Location |
| `CallPhone` | Callback |
| `CallerName` | Caller name |
| `UnitList` | Units array |
| Coordinates | `cadCoordinates` when trusted |

---

## Appendix C: Compliance notes

Document Tyler’s **data processing** terms alongside your **CJIS** / state requirements. If a **broker** is used, that host is in **your** security boundary and must be hardened and audited.
