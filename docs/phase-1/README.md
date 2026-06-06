# Phase 1 — Repository and core architecture

**Goal:** Monorepo layout, typed packages, web under `apps/web`, shared contracts, formatting, and local dev.

## Deliverables

| Item | Location |
|------|----------|
| Folder structure | `apps/web`, `apps/api`, `packages/*`, `infra`, `docs`, `demo` |
| Package manifests | Each workspace `package.json` |
| Build scripts | Root `package.json` `build`, per-package `build` |
| Environment template | [`.env.example`](../../.env.example) |
| Product + engineering docs | [`docs/phase-0/`](../phase-0/), this file |

## Exit criteria

- [x] **App compiles** — `npm run build -w rapid-cortex-web` succeeds after `npm install`.
- [x] **Shared packages import** — `apps/web` imports `rapid-cortex-shared`, `rapid-cortex-protocols`, `rapid-cortex-integrations`, `rapid-cortex-security` (see `lib/phase1-workspace.ts`).
- [x] **Local dev** — `npm run dev:web` from repository root runs Next.js in `apps/web`.

## Commands (from repo root)

```bash
npm install
npm run build
npm run dev:web
npm run lint:web
npm run format
```
