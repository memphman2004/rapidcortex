# DR test results

Generated reports from `scripts/dr-test.sh` land here as:

```text
dr-test-<STAGE>-<TIMESTAMP>.md
```

Example:

```bash
bash scripts/dr-test.sh staging
# → docs/dr-test-results/dr-test-staging-20260923T185500Z.md
```

- This README is tracked in git.
- Individual `dr-test-*.md` reports are gitignored (local/CI evidence hygiene).
- Destructive soft-delete exercises require `SAFE_DR_DESTRUCTIVE=1` and are refused on `dev`/`prod`.
