# Deployment

Do not deploy production until Jeff Coleman authorizes it. The nested stack is off unless the root parameter is set.

```bash
export AWS_PROFILE=rapid-cortex
export SAM_BUILD_DIR=/tmp/sam-build
export SAM_NODE_MODULES_HARDLINK=1
```

Build from an internal drive, with `--build-dir /tmp/sam-build`. The repo on `/Volumes` must not be the SAM build directory.

1. Deploy the data and app stacks only when you intend to create this feature:

```bash
# staging example — confirm the stage script before running
# IncludeBusinessCardsNestedStack=true
```

2. Leave `ENABLE_BUSINESS_CARDS` false on the Lambda until one agency is ready. Turn that agency on with `PUT /api/admin/business-cards/settings` `{ "enabled": true, "version": 0 }`.
3. Set `NEXT_PUBLIC_ENABLE_BUSINESS_CARDS=1` on the web task only for the environment you are testing. The default in `.env.example` is unset, which hides the nav.
4. Smoke the existing dashboard and the existing QR/NFC screen before enabling a second agency.

Rollback: set the tenant `enabled` flag to false, then set `IncludeBusinessCardsNestedStack` back to `false` on the next root deploy only after the routes are removed on purpose. The table and bucket use `DeletionPolicy: Retain`.

This change set has **not** been deployed to dev, staging, or production.
