# Rapid Cortex C2C hub

Canonical build order: **[`CURSOR_BUILD_SPEC.md`](../../CURSOR_BUILD_SPEC.md)** (16 steps).

| Artifact | Path |
|---|---|
| Common incident types | `packages/common-codes` (`@rc/common-codes`) |
| NENA EIDO parse/build | `packages/eido` (`@rc/eido`) |
| Hub + mock demo | `packages/c2c-hub` (`@rc/c2c-hub`) |
| Southern Software inquiry spec | [SOUTHERN_SOFTWARE_API_SPEC.md](./SOUTHERN_SOFTWARE_API_SPEC.md) |
| CentralSquare inquiry spec | [CENTRALSQUARE_API_SPEC.md](./CENTRALSQUARE_API_SPEC.md) |
| Partner emails | [emails/](./emails/) |
| No-bid as prime | [RFP-6212-26L-NO-BID.md](./RFP-6212-26L-NO-BID.md) |

```bash
npx vitest run packages/common-codes packages/eido packages/c2c-hub
npx tsx packages/c2c-hub/src/run-demo.ts
```
