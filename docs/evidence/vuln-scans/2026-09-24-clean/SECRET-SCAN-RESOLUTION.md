# Secret scan resolution — 2026-09-24

## Finding A — CloudTrail sample AccessKeyId

**File:** `docs/evidence/soc2-evidence/2026-10-snapshot/raw/20260917T225823Z-01-cloudtrail-lookup-events-sample.json`

**Verdict:** Real CloudTrail event metadata from account `158961537080`. Contained live **AccessKeyId** values (`AKIA…` for `rapid-cortex-deploy`, plus temporary `ASIA…` session keys). **No secret access keys** were present.

**Action taken:** Redacted all `AKIA*` / `ASIA*` IDs to `AKIAXXXXXXXXXXXXXXXX` / `ASIAYYYYYYYYYYYYYYYY`. Scanner updated to ignore the `AKIAX{16}` redaction shape.

**Follow-up (ops):** Secret material was not leaked. Optional hygiene: rotate `rapid-cortex-deploy` access keys on a normal cadence; not an emergency unless this sample was published outside the private repo.

## Finding B — PEM in archive CFN template

**File:** `infra/template.monolith.before-nested.yaml` (archive / pre-nested monolith — not the live deploy template)

**Verdict:** Placeholder only (`REPLACE_ME` / `REPLACE` / `replace-me@…`), not a real private key.

**Action taken:** Replaced PEM `BEGIN`/`END` markers with `<GCP_SERVICE_ACCOUNT_PRIVATE_KEY_PEM_PLACEHOLDER>` so scanners do not false-positive.

## Re-scan

`npm run security:scan-secrets` → **no blocked patterns** (see `scan-secrets.txt` in this folder).
