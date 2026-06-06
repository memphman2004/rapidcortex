# RC Lite TypeScript SDK (scaffold)

This directory will host a generated client from `docs/openapi/rc-lite-v1.openapi.yaml`.

Planned tooling:

```bash
npx openapi-typescript ../openapi/rc-lite-v1.openapi.yaml --output ./src/generated/schema.d.ts
```

Until codegen ships, call `fetch` against `/api/v1/*` directly with headers:

- `X-RC-API-Key`
- `X-Request-Id`
- `Idempotency-Key` where required per CAD/export routes
