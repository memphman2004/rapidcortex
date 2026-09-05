# Campus inbound security events (SOC-001 / SOC-022 / SOC-028 / SOC-040)

Rapid Cortex already publishes **outbound** webhooks. This endpoint is a signed **inbound** queue so IU (and later vendors) can dump VMS, ALPR, alarm, and sensor events before native connectors exist.

## Endpoint

```
POST /api/public/campus/{campusCode}/security-events
```

No JWT. HMAC or shared token. Same-origin BFF: `POST /api/public/campus/{campusCode}/security-events`.

Disabled with `ENABLE_CAMPUS_SECURITY_EVENTS=0`. Local/CI mock: `ENABLE_CAMPUS_SECURITY_EVENTS_MOCK=1` (skips signature).

## Body

```json
{
  "source": "vms",
  "type": "intrusion",
  "severity": "high",
  "description": "Door forced — Ballantine Hall",
  "location": {
    "buildingCode": "BALLANTINE",
    "floor": 1,
    "zoneCode": "BH-1",
    "qrRcli": "RCLI-BH-BL-12"
  },
  "payload": { "vendorEventId": "xprotect-123" }
}
```

`source` is `vms | alpr | alarm | sensor | webhook`. `type` maps onto campus incident types when it matches; otherwise a conservative default (`security` / `active_threat` / `other`).

The event creates a campus incident (not a CAD call). Nearest mapped cameras and EAP checklists attach the same way as QR intake. Lockdown and CAD write-back stay fail-closed.

## Signing

Set Lambda env `CAMPUS_SECURITY_EVENT_WEBHOOK_SECRET` (Secrets Manager in ops — not a CloudFormation plaintext env).

**HMAC**

- `X-RapidCortex-Timestamp`: unix seconds
- `X-RapidCortex-Signature`: `v1=<hex>` of `HMAC-SHA256(secret, "{timestamp}.{rawBody}")`

**Shared token** (lab / vendor proof of concept)

- `X-RC-Token: {same secret}`

## Related

- Camera place mapping: campus **Cameras** registry (building / floor / zone / QR)
- EAP library: `/app/campus/{code}/eap`
