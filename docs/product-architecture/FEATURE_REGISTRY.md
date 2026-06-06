# Feature registry

## Where features live

- **Canonical data**: `apps/web/lib/rapid-cortex/features.ts` (plan matrix, requires*, routes, API hints, `envVars`).
- **Narrative copy** (operator / admin / sales + `shortDescription`): `apps/web/lib/rapid-cortex/feature-narratives.data.ts`.

## Plan gating

- Per-plan values use `planAvailability` with `included | limited | add_on | unavailable`.
- Entitlement evaluation: `apps/web/lib/rapid-cortex/entitlements.ts` (`isFeatureEnabledForAgency`, `requireFeatureAccess`).

## Add-ons

- `add_on` in the plan column requires the feature id in `AgencyFeatureConfig.enabledAddOns` (and usually a contract line).

## Limited features

- `limited` in plan: eligible with constraints; `limitedFeatureOverrides` can upgrade treat-as-included for specific ids in agency config (see entitlements implementation).

## CAD safety

- Default CAD mode is **disabled**; then **read-only** where configured.
- **Write-back** needs: `cadIntegrationMode` in assisted/automated as applicable, `writeBackEnabled`, `auditLoggingEnabled === true`, **`agencyApprovedCadWriteBack === true`**, and per-update dispatcher attestation in API routes (not only config).
- **Automated write-back** is **blocked in product** until governance removes the hard block in `evaluateCadWriteBackGuards` for `cad_automated_writeback`.
- **Rapid Cortex does not replace CAD**; it can complement workflows when the agency and vendor have integrated and approved scope.

## Adding a new feature

1. Add a base object in `RAPID_CORTEX_FEATURES_BASE` in `features.ts` (all plan keys, metadata).
2. Add a full entry in `FEATURE_NARRATIVES` in `feature-narratives.data.ts`.
3. Add routes/API placeholders if `requiresBackend` and wire gating in UI.
4. Run `apps/web/lib/rapid-cortex/features.registry.test.ts` and fix validation failures.

## Agency config (pilot / dev)

- `resolveAgencyConfigForUser` / `saveAgencyConfigForUser` in `agency-config-resolver.ts` store overlays in process memory for API PATCH; production should use an agency profile service.
