# Motorola PremierOne + Rapid Cortex Integration Guide

**Version 1.0** | Rapid Cortex Public Safety AI Platform

---

## Overview

This guide describes how to connect **Motorola PremierOne CAD** to **Rapid Cortex** so incident updates can be delivered securely to Rapid Cortex for AI-assisted triage, transcript alignment, and dispatcher workspace features.

**What this integration does**

- Sends selected CAD events (incident create/update/close, unit status) to Rapid Cortex over **HTTPS**.
- Rapid Cortex **normalizes** vendor fields into its incident model; dispatchers see CAD-linked context in the Rapid Cortex workspace.
- Rapid Cortex does **not** replace PremierOne; it is **supplemental intelligence** only.

**Data flow (ASCII)**

```
┌─────────────────┐    HTTPS POST      ┌──────────────────────┐
│ PremierOne CAD  │ ─────────────────► │ api.rapidcortex.us    │
│ (on-prem /      │   JSON or XML      │ /api/cad/webhook/...  │
│  vendor cloud)  │   + auth header    └──────────┬───────────┘
└─────────────────┘                               │
                                                    ▼
                                         ┌──────────────────────┐
                                         │ Validate + parse     │
                                         │ Upsert / log / audit │
                                         └──────────────────────┘
```

**Prerequisites**

- PremierOne CAD **5.0 or newer** (confirm exact build with Motorola).
- CAD **administrator** credentials (or vendor-assisted change window).
- **Rapid Cortex** agency admin can create integrations and copy the webhook URL and token.
- **Outbound HTTPS** from the CAD environment (or integration broker) to Rapid Cortex API endpoints.

**Estimated setup time:** 2–4 hours (excluding change-control approvals).

**Who should be involved**

| Role | Responsibility |
| --- | --- |
| Agency IT / security | Firewall, TLS inspection, proxy exceptions |
| CAD admin / Motorola PS | PremierOne notification configuration |
| Rapid Cortex admin | Create integration, tokens, testing, go-live |
| CAD vendor support | Version-specific UI paths, SSL pinning, troubleshooting |

---

## Prerequisites checklist

- [ ] Rapid Cortex account with **Admin** (or delegated integration role per your tenant policy).
- [ ] PremierOne CAD **5.0+** (document exact version in your change ticket).
- [ ] CAD admin credentials (or Motorola PS engagement).
- [ ] Network path allows **outbound TCP 443** to `api.rapidcortex.us` (and any required update hosts).
- [ ] TLS inspection / SSL-bridging policy documented (see Troubleshooting).
- [ ] Maintenance window scheduled if notifications are edited during peak.

---

## Step 1: Generate integration credentials in Rapid Cortex

1. Sign in at **https://www.rapidcortex.us** (or your agency’s hosted URL, if applicable).
2. Open **Admin → CAD Integrations** (jurisdiction workspace).
3. Click **Add integration** (or equivalent).
4. Select **Motorola PremierOne** (or **Motorola PremierOne** vendor type).
5. Enter a clear **name** (e.g. `Primary CAD — PremierOne Prod`).
6. Create / save the integration so Rapid Cortex generates:
   - **Webhook URL**  
     `https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}`
   - **Security token** (copy from the UI immediately after creation).

> ⚠️ **Critical:** Save the **security token** in your agency password vault now. Many deployments **cannot display the full token again** after initial creation; you may need to **regenerate** if lost.

> 💡 **Tip:** Paste the webhook URL and token into your change ticket and restrict the ticket to security roles only.

---

## Step 2: Configure Motorola PremierOne CAD

Paths vary slightly by version; the following matches **PremierOne “External notifications”** style configuration.

1. Sign in to **PremierOne CAD Administration** (separate from dispatcher consoles if split).
2. Navigate: **System Administration → Integrations → External Notifications** (or **System → Integrations → External Notifications** on some builds).
3. **Add notification** (or **Add outbound integration**).
4. Set **URL** to the Rapid Cortex webhook from Step 1 (exact string, no trailing slash unless your IT standard requires it).
5. Set **Method** to **POST**.
6. Set **Format** to **JSON** (preferred) or **XML** if your integration middleware translates to JSON before Rapid Cortex.
7. **Authentication — custom HTTP header**
   - Header name: `X-RC-Token` (unless your Rapid Cortex tenant documents a different header).
   - Header value: the **security token** from Step 1.
8. **Events to enable** (recommended minimum):
   - `IncidentCreate`
   - `IncidentUpdate`
   - `IncidentClose`
   - `UnitStatusChange`
   - `UnitAssign` / `UnitUnassign` (if available and desired for unit rosters)
9. **SSL / TLS:** Use system trust store; if you use **SSL inspection**, see Step 3 and Troubleshooting.
10. **Save** and **Activate** the notification profile.

> 💡 **Tip:** Start in a **test** or **training** CAD partition if available; mirror the same Rapid Cortex integration in a **testing** status before production cutover.

---

## Step 3: Firewall / network configuration

**Outbound HTTPS (TCP 443)** must be permitted from the **system that terminates the webhook** (PremierOne app server, integration service, or ESB) to:

| Host | Purpose |
| --- | --- |
| `api.rapidcortex.us` | Primary API — webhook delivery |
| `downloads.rapidcortex.us` | Desktop / client updates (often separate from CAD webhook) |

**IP ranges**

Rapid Cortex production API is served via **AWS API Gateway**. Public IP ranges **change** over time. Do **not** hard-code a static list from an old PDF.

> 💡 **Recommended:** Use **AWS-managed prefix lists** or subscribe to AWS IP range notifications for **API Gateway** in `us-*` regions as documented in [AWS IP address ranges](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html). Your security team can allowlist by **FQDN + egress proxy** where policy permits.

**TLS**

- Minimum **TLS 1.2** end-to-end.
- If a **forward proxy** is required, configure PremierOne or the broker to use it explicitly; avoid “transparent” breaking TLS without importing corporate roots on the CAD side.

---

## Step 4: Test the connection

1. In Rapid Cortex: **Admin → CAD Integrations →** select your integration.
2. Click **Send test incident** (or run a vendor test notification if available).
3. Confirm the test appears in the **dispatcher workspace** (queue / incident detail as designed for your build).
4. Open **Raw webhook log** (or equivalent diagnostics) and confirm HTTP **200** and a parsed payload record.

---

## Step 5: Validate data mapping

| Check | Pass criteria |
| --- | --- |
| [ ] Incident number | CAD incident / call number matches Rapid Cortex `cadIncidentId` / display |
| [ ] Priority | CAD numeric/text priority maps to Rapid Cortex urgency / CAD priority display per your mapping table |
| [ ] Location / address | Street / common name appears in CAD location fields |
| [ ] Caller callback | Present when CAD provides it; **never** log full numbers in shared tickets |
| [ ] Unit assignments | Units list matches CAD assignment events |
| [ ] Nature / type | Nature code or incident type maps to category / labels |

> 💡 **Tip:** Align on a written **priority mapping table** (e.g. CAD `1` → P1) before go-live; keep it in the agency knowledge base.

---

## Step 6: Go live

- [ ] Pilot **3–5 real incidents** (or a full shift in **testing** status) before full cutover.
- [ ] Brief dispatchers: Rapid Cortex is **supplemental**; **CAD remains system of record**.
- [ ] Confirm **audit** and **retention** settings meet CJIS / local policy.
- [ ] Record **go-live date/time** and owning contacts.

---

## Troubleshooting

| Issue | Likely cause | Fix |
| --- | --- | --- |
| No incidents in Rapid Cortex | Firewall / proxy blocking 443 | Verify egress to `api.rapidcortex.us`; test `curl` from same subnet as CAD publisher |
| HTTP 401 / auth errors | Wrong or rotated token | Regenerate token in Rapid Cortex; update PremierOne header value |
| SSL / certificate errors | TLS inspection or missing trust chain | Import enterprise root on publisher, or bypass inspection for this egress path per policy |
| Partial / missing fields | Event subset too narrow | Enable additional PremierOne events (updates, units) |
| Duplicates | Retries without idempotency key | Confirm CAD retry policy; open ticket with Rapid Cortex support with **masked** samples |

> ⚠️ **Security:** Do **not** paste live caller PII into email. Use agency ticketing with access controls.

---

## Data security & compliance

- **In transit:** TLS 1.2+ to Rapid Cortex API.
- **At rest:** Rapid Cortex uses AWS-managed encryption (e.g. **AES-256**) for application data stores.
- **Access control:** CJIS-aligned RBAC; agency data is **tenant-scoped** (`agencyId` on all application data paths).
- **Retention:** Default **90 days** for certain CAD troubleshooting artifacts where enabled; confirm your tenant configuration.
- **Isolation:** No cross-agency sharing of CAD payloads unless explicitly configured by authorized workflows.
- **Audit:** Security-relevant actions are audit-logged per Rapid Cortex policy.

---

## Support contacts

| Channel | Detail |
| --- | --- |
| Rapid Cortex Support | [support@rapidcortex.us](mailto:support@rapidcortex.us) |
| Emergency | Use your **agency security / SOC** path and Rapid Cortex **priority** channel if contracted. |
| Motorola Solutions (example) | **1-800-367-2346** — confirm current numbers on [Motorola Solutions](https://www.motorolasolutions.com/) for your contract. |

---

## Appendix A: Sample JSON payload (illustrative)

> **Note:** Field names vary by PremierOne version and integration profile. Treat this as a **shape example** only.

```json
{
  "IncidentNumber": "2025-014892",
  "NatureCode": "STRUCTURE FIRE",
  "IncidentType": "FIRE RESIDENTIAL",
  "Priority": "1",
  "Location": "1200 BLOCK PINE ST, SPRINGFIELD",
  "CallbackNumber": "5550100",
  "CallerName": "J DOE",
  "AssignedUnits": ["E12", "L1", "BC3"],
  "Latitude": 39.7817,
  "Longitude": -89.6501,
  "IncidentStatus": "DISPATCHED",
  "EventType": "IncidentUpdate"
}
```

---

## Appendix B: Field mapping reference (PremierOne → Rapid Cortex)

| PremierOne (example) | Rapid Cortex usage |
| --- | --- |
| `IncidentNumber` | CAD incident identifier / linkage |
| `NatureCode` / `IncidentType` | Nature / type display; may inform category |
| `Priority` | CAD priority / urgency mapping |
| `Location` | CAD formatted address |
| `CallbackNumber` | Callback (handle as CJI) |
| `CallerName` | Caller name (CJI) |
| `AssignedUnits[]` | CAD units |
| `Latitude` / `Longitude` | `cadCoordinates` when present |
| `IncidentStatus` | CAD-side status string |
| Raw envelope | Optional `cadRawPayload` (JSON string) for troubleshooting windows |

---

## Appendix C: Compliance notes

- Treat webhook payloads as **CJI** unless your agency classification says otherwise.
- **CJIS Security Policy** controls apply to agencies under CJIS agreements; map this integration to your **CJIS IPA / connectivity** documentation.
- **SOC 2** and similar attestations cover Rapid Cortex service operations; your agency maintains responsibility for **CAD** configuration and user access.
- Document this path in your **System Security Plan (SSP)** or equivalent.
