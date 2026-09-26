# Checkov + PSAP enrichment evidence — 2026-09-25

## Checkov (CloudFormation)

Installed in `~/.rapid-cortex-checkov-venv` (Checkov **3.3.19**).

| Target | Result |
|---|---|
| `infra/nested/` | **Passed 1231 / Failed 0 / Skipped 0** — `checkov-infra-nested.txt` |
| `infra/nested/psap-enrichment-place-index.yaml` | See `checkov-place-index.txt` |
| `infra/template.yaml` | SAM transform root — Checkov emitted no resource checks (`checkov-infra-root.txt`) |

Re-run:

```bash
~/.rapid-cortex-checkov-venv/bin/checkov -d infra/nested --framework cloudformation --compact
```

## PSAP enrichment smoke (geo IAM + place index)

```
STAGE=dev npx tsx scripts/enrich-psap-addresses.ts --dry-run --state=GA --limit=5
```

Result (`enrich-psap-dry-run.txt`): **ENRICH_EXIT=0** — place index `rapid-cortex-psap-enrichment-dev` reachable; 3 reverse-geocode dry runs succeeded, 2 skipped (already addressed).

## LEG-010

Inquiry draft ready to send: [LEG-010-PENTEST-INQUIRY.md](../../../security-compliance/soc2/LEG-010-PENTEST-INQUIRY.md).
