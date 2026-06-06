# Demo assets

## Customer program documentation bundle

Release engineering (or SE) can ship a **standard customer/agency documentation ZIP** to each jurisdiction:

- **Manifest:** [`customer-program-documentation-bundle.json`](./customer-program-documentation-bundle.json) — repository-relative paths; `coverFile` is the recommended cover document; `staticManualFile` is the bundled **Complete Operations Manual** (single HTML).
- **Build:** from the repository root, run `npm run package:customer-docs` (requires `zip` on `PATH`). Output: `dist/rapid-cortex-customer-program-docs-<YYYYMMDD>.zip`.
- **Hosted manual (deployed web):** with the file under `apps/web/public/docs/`, production serves it at `https://www.rapidcortex.us/docs/rapidcortex-complete-manual.html` (static asset from `public/`).

Narrative context for what belongs in the bundle: [`docs/JURISDICTION_OPERATIONS_GUIDE.md`](../docs/JURISDICTION_OPERATIONS_GUIDE.md) — Appendix A.

---

Use this folder for **repeatable pilot and sales demos**:

- Scripted call flows and expected AI/protocol outcomes
- Screen recording storyboards
- CSV / JSON fixtures that are safe to share publicly

Application code for **demo mode** lives in `apps/web` (e.g. demo pages under **`https://www.rapidcortex.us/<city-town-or-county-slug>/demo`**, scenario library) and `apps/api` (demo handlers). Keep **synthetic data only** here unless cleared for pilot.
