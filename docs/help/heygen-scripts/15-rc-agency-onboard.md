# 15 — RC Admin: onboarding an agency

| Field | Value |
|---|---|
| Video ID | `rc-agency-onboard` |
| Audience | rcadmin, rcsuperadmin, rcitadmin |
| Target length | 7:00 |
| Tone | Platform operator; tenant isolation |

## On-screen cues

1. RC Admin → Agencies → Create
2. Agency type picker (city, venue, campus, transit, …)
3. Invite Agency Admin with correct `custom:role`
4. Feature flags; CAD write-back **off**
5. Deliver sign-in URL + Help / Staff Guide
6. Wrong type / role = wrong product shell

## Narration (HeyGen)

This lesson is for NexCort platform admins onboarding a new agency tenant.

Open Agencies and create or provision the tenant. Set agency type correctly — city or county for PSAP, venue, campus, transit, and other supported types. Agency type drives product routing. A wrong type can collapse a vertical customer into the wrong shell after login.

Invite the Agency Admin with the correct custom role attribute. Confirm feature flags match the contract. Leave CAD write-back fail-closed until go / no-go criteria and written authorization. Do not enable production write-back as a convenience.

Send the agency its sign-in URL — never a cross-tenant bookmark — plus Help for PSAP seats or Staff Guide for campus, venue, and transit. Confirm M-F-A enrollment on a test seat before go-live.

You operate the multi-tenant platform. You do not “help” by logging into a customer dispatcher seat under their identity. Keep tenant isolation sacred. Document the onboard in your runbook with agency I-D, type, and go-live window.

Correct type, correct roles, write-back off until authorized — that is a clean onboard.
