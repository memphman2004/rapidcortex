# Public API hostnames (agency-facing)

## Allowed

| Host | Use |
|------|-----|
| `https://api.rapidcortex.us` | Public API edge (CloudFront + WAF) |
| `https://app.rapidcortex.us` | Dispatcher / ops / sales web |

## Forbidden in agency docs, ChatGPT Actions, partner runbooks, and RFPs

- `https://*.execute-api.*.amazonaws.com` (any HttpApi id)
- Raw CloudFront distribution domains as the agency contract URL

Those execute-api endpoints remain valid **internal** origins for CloudFront and engineering smoke tests. They must not appear in materials customers or third-party agents are given.

## Why

Autonomous scanners (including ARTEX-class agents) harvest execute-api hostnames from public docs and GitHub. Keeping a single WAF-fronted hostname concentrates rate limits, Bot Control, Anonymous IP block, and Deception Shield telemetry.
