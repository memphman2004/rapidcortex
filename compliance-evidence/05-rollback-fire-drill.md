# 05 - Rollback Fire Drill Execution

## Objective

Validate emergency rollback path and service continuity for a deployment incident.

## Runbook References

- `docs/operations-runbooks/INCIDENT_RESPONSE_RUNBOOK.md`
- `scripts/post-deploy-smoke.sh`

## Drill Steps Executed

1. Baseline smoke check against deployed dev stack.
2. Simulated monitoring incident using alarm state transition (captured in `04-monitoring-alarm-test.md`).
3. Post-incident health verification to confirm service remains operational.

## Commands Executed

```bash
bash scripts/post-deploy-smoke.sh dev us-east-1
```

Output:

```text
PASS health endpoint: 200
PASS unauthenticated me endpoint: 401
Smoke checks completed successfully for rapid-cortex-dev
```

## Drill Outcome

- API remained healthy after incident simulation.
- No manual rollback command was required for this drill scenario.
- Operational rollback readiness is **partially validated** (monitor + verify path).

## Remaining for Full Production Fire Drill

- Execute a true deployment rollback in staging/pilot (deploy N-1 artifact).
- Validate customer communication workflow and RTO timestamps.
- Capture authenticated smoke checks with designated smoke test account.
