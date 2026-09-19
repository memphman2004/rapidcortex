# Nest SDM activation (Track 3)

**Agency linking:** deployable now. Command staff paste their Google Device Access `projectId` + OAuth client into **Admin → Integrations → Google Nest** (`NestIntegrationSettings`). That path does **not** wait on Rapid Cortex’s own Device Access project.

**Citizen self-enrollment** (`/connect/nest`): blocked until Google approves Rapid Cortex’s Device Access project. Without `NestRcOauthSecretArn`, the citizen OAuth helper returns **503** (`getNestRcOauthCredentials`).

## Agency linking (do this now)

1. Agency admin (or campus/venue/transit supervisor) opens `/{jurisdiction}/admin/integrations`.
2. Enters the agency’s SDM project id, OAuth client id, and client secret.
3. Completes Google Partner Connect. Callback: `https://api.rapidcortex.us/api/cameras/providers/nest/callback` (override with `NEST_REDIRECT_URI`).
4. Status: `GET /api/cameras/providers/nest/status`. Connected agencies get command-staff camera feeds in Rapid Vision™ Nest (UI defaults on when `NEXT_PUBLIC_ENABLE_CONNECT_NEST` is unset).

OAuth client redirect URIs that must be registered on the **agency** Google Cloud OAuth client:

- `https://api.rapidcortex.us/api/cameras/providers/nest/callback`
- Staging (engineering only): `https://app-staging.rapidcortex.us/api/cameras/providers/nest/callback`

## Device Access application (citizen path)

File at [Google Nest Device Access](https://console.nest.google.com/device-access) if it is not already submitted.

| Field | Value |
|---|---|
| Company | Apps on Demand LLC d/b/a Rapid Cortex |
| Product | Rapid Vision™ — consent-gated emergency camera share |
| Use | Public safety / 911 and campus-venue command staff request **temporary** live video from a Nest device **after the owner Allow** |
| Sandbox vs commercial | Sandbox is fine for agency-owned devices. Citizen enrollment at `www.rapidcortex.us/connect/nest` needs **commercial** Device Access (Google review). |
| OAuth redirect | `https://api.rapidcortex.us/api/cameras/providers/nest/callback` |
| Citizen landing | `https://www.rapidcortex.us/connect/nest` |
| Secret once approved | Secrets Manager JSON `{ "clientId", "clientSecret", "projectId" }`; pass `NEST_RC_OAUTH_SECRET_ARN` into `deploy.sh` |

Do **not** claim Ring-style Appstore certification for Nest. Do **not** access cameras without a per-request Allow.

After Google approval:

```bash
# Create (once) then pass ARN on live deploy — never commit the JSON.
aws secretsmanager create-secret \
  --name rapid-cortex/connect/nest-rc-oauth \
  --secret-string '{"clientId":"…","clientSecret":"…","projectId":"…"}'
export NEST_RC_OAUTH_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id rapid-cortex/connect/nest-rc-oauth --query ARN --output text)"
source scripts/env-api-dev.sh && bash scripts/deploy.sh dev
```

Until that ARN is set, keep selling **agency linking** as the Nest feed for command staff.

## Staging

`ENABLE_CONNECT_NEST=true` is already in `scripts/env-api-staging.example.sh`. Citizen 503 on staging is expected without `NEST_RC_OAUTH_SECRET_ARN`.
