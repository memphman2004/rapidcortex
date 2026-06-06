# CAD integration master checklist

**Version 1.0** | Rapid Cortex Public Safety AI Platform  
**Use with:** Motorola PremierOne · Tyler New World · CentralSquare · Hexagon I/CAD · Generic webhook

> 💡 **Tip:** Print this page and attach the **vendor-specific** guide from [README.md](README.md) to your change ticket.

---

## Pre-integration

- [ ] **Identify CAD vendor** and exact **version / build** (screenshot from CAD About screen).
- [ ] **Agency IT owner** named (primary + backup).
- [ ] **CAD vendor support contact** / ticket queue identified.
- [ ] **Rapid Cortex admin** access confirmed (role documented).
- [ ] **Maintenance window** scheduled (if CAD admin changes are sensitive).
- [ ] **Data classification** agreed (payloads treated as **CJI** unless agency policy states otherwise).

---

## Rapid Cortex setup

- [ ] **Admin → CAD Integrations** → **Add integration** completed.
- [ ] **Webhook URL** saved: `https://api.rapidcortex.us/api/cad/webhook/{agencyId}/{integrationId}`
- [ ] **Security token / secret** saved in **enterprise vault** (not email / chat).
- [ ] Integration **status** set appropriately (`testing` → `active` after validation).
- [ ] **Generic only:** field mappings configured and **peer-reviewed**.

> ⚠️ **Critical:** If the token is lost, **regenerate** and update **every** CAD/middleware profile that used the old value the same day.

---

## Network / security

- [ ] **Firewall / proxy:** outbound **TCP 443** permitted to `api.rapidcortex.us`.
- [ ] **Connectivity test** from the **same subnet** as the webhook sender (not only from IT laptop):  
  `curl -sS -o /dev/null -w "%{http_code}" https://api.rapidcortex.us/api/health`  
  (or your tenant’s documented health URL if different).
- [ ] **TLS inspection:** documented bypass or corporate CA trust on the **publisher** host (if applicable).
- [ ] **Firewall change ticket #** recorded.

> 💡 **IP allowlists:** Prefer **FQDN-based egress** policy where possible; AWS API Gateway IPs **change**—see [AWS IP address ranges](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html).

---

## CAD system configuration

- [ ] Outbound **POST** (or approved broker) configured per **vendor guide**.
- [ ] **Rapid Cortex webhook URL** pasted **exactly** (no accidental spaces).
- [ ] **Security header / token** matches Rapid Cortex (name + value).
- [ ] **Events** enabled: at minimum **create + update + close** (and **units** if required by ops).
- [ ] **Save** + **activate** in CAD admin UI.
- [ ] **SSL/TLS** errors cleared in CAD test tool.

---

## Testing

- [ ] **Rapid Cortex:** “Send test incident” from integration detail → **success**.
- [ ] **Dispatcher workspace:** test incident visible with expected fields.
- [ ] **Raw webhook log** (or equivalent): HTTP **200**, no auth failures.
- [ ] **Live / staging CAD:** **3** controlled test incidents (or vendor sandbox) processed end-to-end.
- [ ] **Dispatcher sign-off** on **data quality** (priority, location, units, callback presence).

---

## Go live

- [ ] Integration set to **active** in Rapid Cortex.
- [ ] **First operational shift:** monitor **15–30 minutes** with IT + comms floor POC.
- [ ] **Error log** reviewed in **Admin → CAD Integrations** (no sustained 4xx/5xx).
- [ ] **Dispatcher briefing** completed (Rapid Cortex is **supplemental**; CAD is **system of record**).
- [ ] **Go-live date/time** and **on-call** names recorded.

---

## Post go-live (first 30 days)

- [ ] **Week 1:** daily spot-check of error rate / missed incidents.
- [ ] **30-day check-in:** review volume, mapping drift, token rotation needs.
- [ ] **Write-back (if enabled):** supervisor approval path tested per policy.
- [ ] **CJIS / compliance packet** updated if your agency requires formal documentation.

---

## Quick vendor guide index

| Vendor | Document |
| --- | --- |
| Motorola PremierOne | [motorola-premierone-integration-guide.md](motorola-premierone-integration-guide.md) |
| Tyler New World | [tyler-new-world-integration-guide.md](tyler-new-world-integration-guide.md) |
| CentralSquare | [centralsquare-integration-guide.md](centralsquare-integration-guide.md) |
| Hexagon I/CAD | [hexagon-icad-integration-guide.md](hexagon-icad-integration-guide.md) |
| Generic webhook | [generic-webhook-integration-guide.md](generic-webhook-integration-guide.md) |

---

## Support

- **Rapid Cortex:** [support@rapidcortex.us](mailto:support@rapidcortex.us)

---

## Sign-off block (optional)

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Agency IT | | | |
| CAD admin | | | |
| Rapid Cortex admin | | | |
| Communications / dispatch supervisor | | | |
