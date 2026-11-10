# Feature registry

## Where features live

- **Canonical product matrix**: `apps/web/lib/rapid-cortex/features.ts` (plan matrix, requires*, routes, API hints, `envVars`).
- **Narrative copy** (operator / admin / sales + `shortDescription`): `apps/web/lib/rapid-cortex/feature-narratives.data.ts`.
- **Billable add-on SKUs (agency can pick a-la-carte)**: `packages/shared/src/billing/addon-types.ts` (`ADDON_KEYS`) + `addon-catalog.ts` (`ADDON_CATALOG`).
- **Master list prices**: `packages/shared/src/billing/pricing-defaults.ts`.
- **Sales Features Catalog (no prices)**: `packages/shared/src/sales/sales-feature-catalog.ts` + UI at `/sales/features-catalog` (legacy `/sales/pricing-catalog` redirects).
- **NC Admin price sheet tabs**: `apps/web/lib/pricing/pricing-catalog.ts` (`ADDON_SECTIONS` must use real `ADDON_KEYS` / pricing-defaults keys).
- **Agency toggles**: RC Admin `/rc-admin/agencies/{id}/features` and agency-admin Features — render from `ADDON_CATALOG`.

## Plan gating

- Per-plan values use `planAvailability` with `included | limited | add_on | unavailable`.
- Entitlement evaluation: `apps/web/lib/rapid-cortex/entitlements.ts` (`isFeatureEnabledForAgency`, `requireFeatureAccess`).
- Billing → product feature ids: `apps/web/lib/rapid-cortex/tenant-addon-feature-bridge.ts`.
- API commercial gate: `requireAddon("<addon.key or family>")` in `apps/api/src/middleware/requireAddon.ts` (JWT `custom:addons` → agency.addons → plan-included).

## Add-ons

- `add_on` in the plan column requires the feature id in `AgencyFeatureConfig.enabledAddOns` (and usually a contract line).
- Agency commercial entitlement is the matching `ADDON_CATALOG` key (or family prefix).

## Limited features

- `limited` in plan: eligible with constraints; `limitedFeatureOverrides` can upgrade treat-as-included for specific ids in agency config (see entitlements implementation).

## CAD safety

- Default CAD mode is **disabled**; then **read-only** where configured.
- **Write-back** needs: `cadIntegrationMode` in assisted/automated as applicable, `writeBackEnabled`, `auditLoggingEnabled === true`, **`agencyApprovedCadWriteBack === true`**, and per-update dispatcher attestation in API routes (not only config).
- **Automated write-back** is **blocked in product** until governance removes the hard block in `evaluateCadWriteBackGuards` for `cad_automated_writeback`.
- **NexCort iQ does not replace CAD**; it can complement workflows when the agency and vendor have integrated and approved scope.

## Adding a new standalone feature (checklist)

Mirror `docs/rcs/README.md`:

1. Add key to `ADDON_KEYS` in `packages/shared/src/billing/addon-types.ts`.
2. Add `ADDON_CATALOG` entry in `packages/shared/src/billing/addon-catalog.ts` (category, price, `planAvailability`, optional `featureFlag`).
3. Add default dollars in `packages/shared/src/billing/pricing-defaults.ts`.
4. Add a row in `apps/web/lib/pricing/pricing-catalog.ts` `ADDON_SECTIONS` using the **same key** (no orphan sales-only keys).
5. Add sales narrative in `packages/shared/src/sales/sales-feature-catalog.ts` (Features Catalog UI).
6. Seed row in `scripts/seed-pricing-store.ts` when the Dynamo pricing store is used.
7. Add base object in `RAPID_CORTEX_FEATURES_BASE` (`features.ts`) + full entry in `FEATURE_NARRATIVES`.
8. Map `AddonKey` → feature registry ids in `tenant-addon-feature-bridge.ts`.
9. Wire `requireAddon("your.addon.key")` on **create/session** HTTP paths (do not break public SMS/consent landings).
10. Optionally extend `packages/shared/src/monetization/plan-ids.ts` + `catalog-defaults.ts` when monetization add-on ids mirror the SKU.
11. Run `apps/web/lib/rapid-cortex/features.registry.test.ts` and billing/addon catalog tests.

### Video / media SKUs (standalone)

| Addon key | Product |
|---|---|
| `caller_media.video_assist` | Video Assist (SMS P2P) |
| `caller_media.live_video_kvs` | Live Video (KVS) |
| `vision.iq_vision` | iQ Vision™ scene AI |
| `connect.nest` / `connect.wyze` | Nest / Wyze Connect |
| `rc_video.wall` / `rc_video.ptz_gateway` | Video wall / PTZ gateway |
| `milestone.xprotect` | Milestone XProtect bridge |
| `feature_addons.rc_connect_*` | Facility ONVIF/RTSP camera **packs** (not Vision AI) |

Ring camera OAuth remains suspended — do not add a sellable Ring camera SKU.

## Agency config (pilot / dev)

- `resolveAgencyConfigForUser` / `saveAgencyConfigForUser` in `agency-config-resolver.ts` store overlays in process memory for API PATCH; production should use an agency profile service.
