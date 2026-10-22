# Production readiness

Not ready for production. Jeff Coleman has not authorized a production deploy, and this change set has not been deployed anywhere.

## Go / no-go

- [x] Unit tests for slug, vCard, visibility, locks, tenant isolation, and NFC revoke passed locally (13 tests).
- [ ] Dev stack created (`IncludeBusinessCardsNestedStack=true`) and one agency enabled.
- [ ] Staging admin creates, publishes, locks, and revokes a card.
- [ ] Public `/card/{slug}` and `/c/{cardId}` checked in a browser on the app host.
- [ ] Existing QR/NFC programming smoke-tested after the web build.
- [ ] Photo CloudFront OAC decided.
- [ ] `www.nexcortiq.us` route for `/card` and `/c` decided without editing an unrelated distribution by accident.
- [ ] Physical NFC and QR checks (0 of 7).
- [ ] Production authorization from Jeff Coleman.

## Test log

`npx vitest run apps/api/src/lib/business-cards/domain.test.ts apps/api/src/lib/business-cards/service.test.ts`

Result: 2 files, 13 tests, passed.

Playwright is not configured in this repo. End-to-end specs were not added and were not run.

Physical device checks: 0 of 7. All pending.
