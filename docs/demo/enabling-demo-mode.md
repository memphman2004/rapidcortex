# Enabling Demo Mode

Demo Mode is off unless someone turns it on. A normal NexCort iQ deployment does not load Maplewood County data and does not intercept live API calls.

## Turn on a whole demo instance

Set both of these in the task environment. Do not commit a real value, and do not set them on a live PSAP deployment.

```bash
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
```

`NEXT_PUBLIC_DEMO_MODE` is what the browser reads. `DEMO_MODE` is what the server reads. With both set, every page on that instance shows the amber bar and API calls stay inside the fictional center.

Open `/demo-link` to pick a scenario.

## Turn on shareable links

Store the signing key in AWS Secrets Manager as `rapid-cortex/demo/token-signing-key`. The secret value can be a plain string or JSON `{ "secret": "..." }`.

Pass it to the web service as `DEMO_TOKEN_SIGNING_SECRET`. Do not put the value in git.

Optional, for revoking links across more than one server:

```bash
DEMO_TOKEN_REVOKED_IDS=jti-one,jti-two
DEMO_TOKEN_REVOKED_ISSUERS=former-rep
```

An administrator who can sign in as `rcsuperadmin`, `rcadmin`, or `salescontractor` creates links from the demo control panel. The panel calls `POST /api/demo/tokens`. Prospects open `/demo-link/s/{token}` with no account.

The Lambda in `apps/api/src/handlers/demo/demoTokens.ts` is the same signer for a future API deployment. The nested template `infra/nested/stack-demo-tokens.yaml` is not attached to the parent stack. Attaching it is a separate, explicit infrastructure change. Until that change, the Next.js route is the signer and it reads the same secret.

## Demo user role

Shareable links are the supported way to put a prospect in the demo.

A Cognito group named `demo` with no IAM role and a user whose `custom:role` is the literal `demo` will also switch the signed-in browser into Demo Mode. That role is not part of the production role matrix. Do not add it to the canonical role list, and do not give that user any agency, incident, or admin permission. Product routing for an unknown role still needs a role-matrix decision before that account can be used as a day-to-day login. Until then, use the instance flag or a shareable link.

## What stays isolated

- Fictional traffic is answered in the browser. It is not written to production DynamoDB tables.
- The production WebSocket is not opened while a demo session is active.
- A bad, expired, or revoked link stops on a plain message page.

## Remove Demo Mode

Unset `DEMO_MODE` and `NEXT_PUBLIC_DEMO_MODE`. The amber bar, the fetch fence, and the demo socket go away. The two code gates are the `isDemoModeActive()` blocks in `apps/web/lib/api.ts` and the two WebSocket hooks. The banner mount in `apps/web/app/providers.tsx` renders nothing while the flag is off.
