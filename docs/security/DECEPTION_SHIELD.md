# Rapid Cortex Deception Shield

## Purpose and scope

Deception Shield is a defensive deception layer comprising:

1. Synthetic HTTP endpoints that imitate sensitive internal integrations (CAD, NCIC snapshots, backups, pseudo-secrets paths, etc.).
2. Honey-token matching on authenticated traffic paths (JWT bearer fragments, explicit API keys within headers, URLs, JSON bodies).

It exists to lure automated scanners toward isolated surfaces, correlate behaviors, tier risk severity, emit structured telemetry, and — when alerting is enabled — raise operator notifications via existing Rapid Cortex operational channels (`OpsAlertsTopic`).

## What it does NOT do

- It does **not** provide law-enforcement attribution, criminal intelligence, identity resolution, nor evidentiary timelines suitable for adjudication workflows.
- It does **not** modify production DynamoDB workloads except the **`DeceptionEvents`** table specifically provisioned for this feature.
- It does **not** export real environmental secrets — all decoy payloads are synthesized constants under `apps/api/src/handlers/deception/fakeData.ts`.
- It does **not** replace WAF posture. `DECEPTION_AUTO_BLOCK_ENABLED` presently acts as a reserved future-integration flag with no ingress enforcement semantics wired in SAM today.

### Safety isolation (ASCII sketch)

```
                 Internet / Partner uplinks
                            |
                       API Gateway
              +------------+-------------+
              |                          |
 Authenticated JWT graph                 |-----+ Unauthenticated deception graph
 (`getUserContext`)                      |
      | Honeytoken middleware            | Dedicated Lambda handlers
      | (shared auth path)               | (`handlers/deception/*`)
      v                                  v
 Persist `HONEYTOKEN_USED`/`AUTH_*    Persist `DECOY_ROUTE_HIT`/CRITICAL ladders
 correlations` ONLY via                  ONLY via deception persistence helpers
 deception persistence                  (no Cognito / Secrets imports)
      |                                  |
      +-------------+----------------------+
                     |
               DynamoDB · DeceptionEvents
                     |
                     v
 Structured CloudWatch + optional SNS Slack webhook (sanitized payloads only)
                     |
                     +--> Admin dashboards / SOC review (rc_admin/it_admin)
```

Decoy Lambda sources assert module isolation (`assertDeceptionModuleIsolation`). Shared runtime checks (`vitest`) enforce that forbidden imports never enter the deception subtree.

### Decoy route inventory

| Methods | Route | Synthetic payload theme |
|---------|-------|--------------------------|
| GET/POST | `/api/internal/cad-sync` | CAD vendor sync façade |
| GET/POST | `/api/internal/cad-writeback` | Writeback acknowledgement |
| GET/POST | `/api/internal/ncic-gateway` | Pseudo NCIC linkage |
| GET | `/api/internal/agency-root` | Pseudo agency enumeration |
| GET | `/api/admin-backup` | Backup façade |
| GET | `/api/rc-lite/root` | RC-lite root metadata |
| GET | `/api/system/secrets` | Fake credential JSON |
| GET | `/api/debug/env` | Fake environment knobs |
| GET | `/api/v1/cad/export-test` | CAD export scaffold |

Honeytokens are enumerated only by symbolic key (`CAD_API_KEY`, `RC_LITE_API_KEY`, …) elsewhere in SOC documentation — never mirrored as literal strings outside `fakeData.ts`.

### Honeytoken inventory (symbolic names only)

- `CAD_API_KEY`
- `RC_LITE_API_KEY`
- `AGENCY_ID`
- `INCIDENT_ID`
- `NCIC_TOKEN`
- `ADMIN_BACKUP_TOKEN`

Operational runbooks cite **names**. Values remain internal to repository constants and Dynamo records never store plaintext honeytoken values beyond the sanitized `payloadSummary`.

## Risk tiers (summary matrix)

| Level | Signals (non-exhaustive) | Alerts | Response guidance |
|-------|-------------------------|--------|-------------------|
| **LOW** | First-time decoy contact, tame UA fingerprints | Structured logs always | Passive watch; annotate change tickets |
| **MEDIUM** | Three or more decoys / 10m, scripted UA fingerprints, heuristic scan cadence | Logs + optional MEDIUM-tier analytics | Correlate CDN/WAF; schedule analyst review queue |
| **HIGH** | Any honey-token usage, spoofed CAD/NCIC synthetics surfaced in sanitized bodies | Logs + SNS (when `DECEPTION_ALERTS_ENABLED`) | Narrow investigation; validate secret scanning / CI safeguards |
| **CRITICAL** | Cross contamination (authenticated context after decoys &lt;5m), duplicated honey usage, risky POST combos | Logs + SNS `CRITICAL: Deception Shield Alert`; optional Slack webhook | Escalate to security lead / IR playbook; tighten edge controls |

PagerDuty/Opsgenie stubs exist programmatically (`alerting.ts`) for backlog integration hooks.

### Alert routing

| Channel | Configuration knobs | Coverage |
|---------|---------------------|----------|
| CloudWatch JSON | Always on for `sendSecurityAlert` | Full structured metadata excluding raw secrets |
| SNS (`OPS_ALERTS_TOPIC_ARN`) | `Globals` SAM parameters | HIGH + CRITICAL |
| Slack webhook stub | Optional `DECEPTION_SLACK_WEBHOOK_URL` | HIGH + CRITICAL summaries |
| Email/SMS chaining | SNS subscription on Ops topic | Inherits SNS fan-out |

PagerDuty Events API / Opsgenie REST flows remain interface-only stubs (see exports in `alerting.ts`) until enterprise demand surfaces.

### Feature toggles (`stack-app-sam*.yaml`)

| Env var | Typical default | Effect |
|---------|-----------------|--------|
| `DECEPTION_SHIELD_ENABLED` | `false` globally | Disabled → decoys 404 + honey middleware bypass |
| `DECEPTION_AUTO_BLOCK_ENABLED` | `false` | Future WAF linkage |
| `DECEPTION_ALERTS_ENABLED` | `true` prod intent | Silence SNS gracefully when `"false"` |
| `NEXT_PUBLIC_ENABLE_DECEPTION_SHIELD_UI` | unset | Frontend shell hidden until flipped |
| `DECEPTION_EVENTS_TABLE` | passed from DataLayer | Persistence requirement for honey/path correlation |

## Deployment checklist

1. Provision `DeceptionEventsTable` (PK `id`; GSIs `sourceIp-createdAt-index`, `correlationId-index`; TTL `ttl` @ 90d). (`infra/nested/stack-data-layer.yaml`).
2. Pass table name parameter through `infra/template.yaml` → `stack-app-sam.yaml` duplicates (and `stack-app-sam-2.yaml` clones if using secondary SAM layout).
3. Confirm dedicated Lambda IAM restricts Decoy Lambda to deception table `{PutItem, Query}` scopes + SNS publish policy for alerting.
4. Validate templates:  
   ```bash
   cd infra && sam validate --lint --template-file template.yaml  
   sam validate --lint --template-file nested/stack-app-sam.yaml  
   sam validate --lint --template-file nested/stack-app-sam-2.yaml
   ```
5. Flip **`DECEPTION_SHIELD_ENABLED`** to `"true"` in target stage after smoke validating fake routes + honey matching.
6. Enable UI flag `NEXT_PUBLIC_ENABLE_DECEPTION_SHIELD_UI=1` on web builds that should surface `/[jurisdiction]/admin/security/deception-shield`.
7. Run automated verification:  
   ```bash
   npx vitest run apps/api/src/handlers/deception/__tests__/deceptionShield.test.ts
   ```

## SOC2 CC6.6 and CJIS 5.3 alignment notes

- **CC6.6 Logical & physical access** — Controlled visibility of deceptive surfaces; restricts persistence to deception-scoped Dynamo resources; sanitized logging prevents credential leakage aligning with detective control expectations.
- **CJIS 5.3 Incident Response** — Facilitates early detection scaffolding for unauthorized probing while explicitly avoiding mixing synthetic attribution with CJIS operational evidence stores (table isolation aids chain-of-custody clarity).

Residual risk: deceptive signals require human analysis; correlate with authoritative network telemetry before containment actions.

## Incident response playbook (risk-tiered cues)

| Declared tier | Starter actions |
|---------------|----------------|
| LOW | Passive logging; annotate security backlog item |
| MEDIUM | Review correlated CDN/WAF + SIEM timelines; widen packet capture selectively |
| HIGH | Pivot on honeytoken key symbolism; initiate credential hygiene review loops |
| CRITICAL | Engage Rapid Cortex security escalation; accelerate WAF/geo blocks if policy allows |

Escalations must document rationale referencing correlation IDs surfaced in sanitized admin exports.

---

For engineering implementation references, inspect:

- Runtime logic: `apps/api/src/handlers/deception/*.ts`
- Admin reader (RBAC guarded): `apps/api/src/handlers/admin/deceptionEventsHttp.ts`
- Web UI shell: `apps/web/app/[jurisdiction]/(dispatch)/admin/security/deception-shield/page.tsx`
