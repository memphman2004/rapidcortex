# Agency IT Overview

Agency IT owns **integrations, MFA, auth troubleshooting, and connectivity tests**. You do not manage billing or live dispatcher coaching — those stay with Agency Admin and Supervisors.

## What you can access

- CAD integration setup and test console
- API keys and webhooks (with Admin policy)
- MFA policy configuration
- User login / auth diagnostics

## Boundaries

- Do not enable CAD write-back without Agency Admin + written authorization
- Do not assign yourself Agency Admin unless that is your job of record
- Never paste production secrets into tickets, Slack, or email

## First tasks on a new tenant

1. Verify Cognito MFA enrollment path works for a test seat.
2. Confirm CAD adapter connectivity in a maintenance window.
3. Document the agency URL staff must use (no cross-tenant bookmarks).
4. Keep a break-glass procedure for locked MFA devices.
