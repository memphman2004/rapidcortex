# Track 3 — Product activation (this month)

These products are built and sitting idle. Sequence from the September 2026 ops table: **Wyze → Nest agency linking → first signed pilot**. October 1 SOC 2 controls stay on Track 1 and are non-negotiable.

| Item | State in repo | Operator action |
|---|---|---|
| **Wyze** | Code + SAM gated `WyzeEnabled=false` | Rotate `rapid-cortex/connect/wyze-api-keys`, then `deploy.sh dev` ([WYZE_ACTIVATION.md](./WYZE_ACTIVATION.md)) |
| **Nest SDM** | Agency OAuth live; citizen 503 without Device Access secret | Link agency Device Access now; file Google Device Access if not submitted ([NEST_SDM_ACTIVATION.md](./NEST_SDM_ACTIVATION.md)) |
| **Pilot pipeline** | Offer + MSA + pricing exist | Get a signature; security reviews get the CJIS/SOC 2 alignment packet ([PILOT_SIGNATURE_PACKET.md](../go-to-market-sales/PILOT_SIGNATURE_PACKET.md)) |

This cloud-agent environment has **no AWS credentials** and cannot file Google Device Access or countersign an MSA. Scripts fail closed with the exact command an operator runs under `AWS_PROFILE=rapid-cortex`.
