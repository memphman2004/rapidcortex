# G2: CAD integration safety (read scope) — evidence template

**Date:** _YYYY-MM-DD_  
**Environment:** _staging_  
**CAD vendor / mode:** _e.g. read_only + staging / Motorola read facade_

## Automated tests

- Command: `npm run test:g2`
- Vitest: `apps/web/lib/rapid-cortex/cad/__tests__/adapter-integration.test.ts`, `staging-cad-read-adapter.test.ts`

## Manual proofs

- [ ] Negative paths (timeout, auth failure, malformed vendor payload) in staging with logs.
- [ ] Feature-flag / mode kill switch exercised (`CAD_INTEGRATION_MODE`).
- [ ] `CAD_WRITEBACK_ENABLED` remains unset or explicitly false; write paths blocked.

## Sign-offs

- [ ] Integrations lead — date: ___
- [ ] Backend lead — date: ___
- [ ] Security lead — date: ___

**Gate status:** _YELLOW until vendor-specific staging proof is attached._
