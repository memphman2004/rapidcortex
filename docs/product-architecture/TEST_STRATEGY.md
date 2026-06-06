# Test strategy (pilot launch)

## Goals

- Catch **tenant and authz** regressions before they reach pilot agencies.
- Keep **AI and multilingual** paths safe with provider mocks and orchestration tests.
- Use **post-deploy smoke** plus optional **authenticated smoke** for real Cognito + API Gateway wiring.

## Layers

| Layer | Tooling | Scope |
| --- | --- | --- |
| Unit | Vitest (`npm test`) | Pure helpers, Zod schemas, orchestrators, redaction, tenant guard |
| Handler integration | Vitest + `vi.mock` on repositories/services | HTTP handlers: authz, status codes, audit redaction, tenant boundaries |
| Web unit | Vitest in `apps/web` | Small UI utilities (`format.ts`, etc.) |
| Post-deploy | Bash [`scripts/post-deploy-smoke.sh`](../scripts/post-deploy-smoke.sh) | Health, anonymous `/api/me`, optional Cognito user |
| Synthetic | [`scripts/synthetic-api-health.sh`](../scripts/synthetic-api-health.sh) | Scheduled liveness |
| Load probe | [`scripts/pilot-load-smoke.sh`](../scripts/pilot-load-smoke.sh) | Parallel health; not a full soak |

## Repository layout

- **Root** `vitest.config.ts` runs `packages/**/*.test.ts` and `apps/**/*.test.ts`.
- **Handler env defaults:** `apps/api/src/handlers/vitest-handler-env.setup.ts` (via `setupFiles`) supplies dummy `AWS_REGION` and table names so handler tests never touch real DynamoDB.
- **Integration-style handler tests** use the `*.handler.integration.test.ts` suffix and `vi.hoisted` for mocks referenced inside `vi.mock` factories.

## Not in scope (yet)

- **Playwright / Cypress** end-to-end against the Next app: no harness in-repo; add when CI browser runners are available.
- **Live provider tests** in CI: keys must not live in the repo; run manually from a secure workstation or isolated account.

## CI recommendation

1. `npm ci && npm run build`
2. `npm test`
3. On merge to deploy branch: `sam build && sam deploy` then `./scripts/post-deploy-smoke.sh <stage> <region>` with secrets-injected **optional** auth variables for staging/pilot.

## Related

- [`PILOT_VALIDATION_CHECKLIST.md`](./PILOT_VALIDATION_CHECKLIST.md)
- [`MONITORING_AND_OPS.md`](./MONITORING_AND_OPS.md)
