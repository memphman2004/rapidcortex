# Feature readiness matrix (Living document)

**Source of truth** for which capabilities exist, how they are sold (plan column), and where they show up in product is the TypeScript registry:

- `apps/web/lib/rapid-cortex/features.ts` — `planAvailability`, `routePath`, `apiEndpoints`, `envVars`, `requires*`, `defaultEnabled`, `rolloutNotes`
- `apps/web/lib/rapid-cortex/feature-narratives.data.ts` — public-facing help copy (`shortDescription`, operator / admin / sales)

This markdown file is a **narrative index**. For a full sortable list, generate from the registry in-repo or use **Admin → Readiness** (`/[jurisdiction]/admin/readiness`) which calls `GET /api/readiness` and evaluates `apps/web/lib/rapid-cortex/readiness.ts` against the current process environment (not a substitute for production monitoring).

| Area | Readiness | Notes |
|------|-----------|--------|
| Core / call / language / media / QA / command / reliability | Registry + route placeholders; many APIs return **501 / configuration required** until backend wiring is complete | Do not present as live until env and services are connected |
| CAD | Default **disabled**; read-only first; write-back only with approvals + audit + adapter | See `docs/CAD_CONNECTION_PLAYBOOK.md` and `lib/rapid-cortex/cad/*` |
| Security | CJIS-**aligned** language in product copy; not “CJIS certified” unless your program has formal certification | |

**Honest status:** many **POST** contract routes in `apps/web/app/api/**` are **stubs** for pilot scoping. Treat registry + docs as the capability map, not a guarantee that every route is a full production implementation without further deployment work.
