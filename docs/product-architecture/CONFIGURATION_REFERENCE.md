# Configuration reference (operator one-pager)

**Deep tables:** [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md) · **Flags:** [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) · **Pilot model:** [PILOT_CONFIGURATION_MODEL.md](./PILOT_CONFIGURATION_MODEL.md) · **Phase 2 dev/staging snippet:** [`scripts/dev-staging-phase2.env`](../scripts/dev-staging-phase2.env)

## SAM / AWS deploy (stack parameters)

`scripts/deploy.sh` and `scripts/deploy-from-env.sh` read environment variables and pass them to `sam deploy` as **CloudFormation parameters** (not Lambda env vars). **AWS profile and region** are the normal CLI values (`AWS_PROFILE`, `AWS_REGION` or `AWS_DEFAULT_REGION`); they are not template parameters.

| Operator env (examples) | SAM parameter / behavior |
| ------------------------ | ------------------------- |
| `APP_NAME=rapid-cortex` | `AppName` — S3 bucket, ops SNS, Cognito post-confirm Lambda name, KVS tag, dashboard name, default stack name when `STACK_NAME` unset |
| `ENV_NAME=dev\|staging\|prod\|pilot` | `deploy-from-env.sh` only — same as the stage argument to `deploy.sh` (`DeploymentStage`) |
| `DDB_TABLE_PREFIX` | `DynamoTableNamePrefix` |
| `DDB_BILLING_MODE=PAY_PER_REQUEST` | `DynamoBillingMode` |
| `DDB_ENABLE_PITR=true\|false\|auto` | `DynamoPointInTimeRecovery` — `auto` matches staging/prod/pilot on, dev off (see template conditions) |
| `COGNITO_USER_POOL_NAME`, `COGNITO_APP_CLIENT_NAME`, `COGNITO_DOMAIN_PREFIX`, `COGNITO_CALLBACK_URLS`, `COGNITO_LOGOUT_URLS` (comma-separated, no spaces), `COGNITO_GENERATE_SECRET` | Cognito `*` parameters; empty `COGNITO_DOMAIN_PREFIX` keeps legacy hosted UI prefix `rapidcortex-{stage}-{account}` |
| `SNS_TOPIC_NAME` | `OpsSnsTopicNameOverride` (optional topic name) |
| `SNS_EMAIL_SUBSCRIPTION`, `SNS_SMS_TEST_NUMBER` | `SnsEmailSubscription`, `SnsSmsSubscription` — `AWS::SNS::Subscription` on the ops topic |
| `SES_IDENTITY_TYPE=email\|domain`, `SES_IDENTITY_VALUE`, `SES_CONFIGURATION_SET_NAME` (optional) | `Ses*` — creates `AWS::SES::EmailIdentity` when type and value are set |

**IAM (deploy principal):** `IAM_ROLE_NAME` and `IAM_POLICY_NAME` are **not** stack outputs; attach a policy that allows SAM deploy (see `infra/iam/`, e.g. `sam-deploy-policy.json`) to the user or role you run the CLI with.

## Who may change what

| Class | Examples | Who |
|-------|----------|-----|
| **Browser public (`NEXT_PUBLIC_*`)** | Site URL, auth proxy toggle, offline demo, training toolbar, docs base | Web deploy / hosting env — **not** secret |
| **Web server-only** | `API_UPSTREAM_BASE`, `COGNITO_CLIENT_SECRET` | DevOps / hosting |
| **Lambda / SAM globals** | AI provider chain, multilingual strict, tables ARNs | Internal ops per [RUNBOOK.md](./RUNBOOK.md) |
| **Cognito pool** | MFA, password policy, custom attributes | Agency IT + RC |

## Where admins **see** (not edit) state

- **Admin → Configuration** — public web env + client-derived flags + embedded integration status panel.
- **Admin → Integrations** — same integration payload, more room for discussion.

## Honest limitations

- No in-app editor for OpenAI keys, Azure keys, or IAM roles.
- Retention **policy** objects in admin settings page are **model/reference** values — enforce in Dynamo/S3 lifecycle per agency program ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).

## Related

- [JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md) — county / city / municipality: who changes what, maintenance cadence, troubleshooting entry, **download package** manifest.
- [AGENCY_CONFIGURATION_GUIDE.md](./AGENCY_CONFIGURATION_GUIDE.md)
- [INSTALLATION.md](./INSTALLATION.md)
