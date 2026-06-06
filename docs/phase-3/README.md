# Phase 3 — Backend core services

**Status:** Core handlers, services, repositories, and SAM infra are implemented; use this folder as the contract reference.

| Doc | Purpose |
|-----|---------|
| [API_ROUTE_MAP.md](./API_ROUTE_MAP.md) | HTTP routes, handlers, auth expectations |
| [DYNAMODB_DESIGN.md](./DYNAMODB_DESIGN.md) | Table keys, GSIs, item models |

## Exit criteria

- Frontend (browser at **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`**) can call backend via **configured base URL** or **auth proxy**.
- **Incident flow** end-to-end: create → list → transcript append → analyze → read analysis.
- **Demo scenario** can run through API (`/api/demo/start`).
