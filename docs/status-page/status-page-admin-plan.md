# Status Page Admin Plan

## Current implementation (safe default)

- Public status data is served by `apps/web/lib/rapid-cortex/status/status-data.ts`.
- Data is currently static, server-side, and intentionally conservative:
  - Default overall status is `operational`.
  - No active incidents by default.
  - No scheduled maintenance by default.
  - Incident history defaults to none in the last 90 days.
  - Uptime metrics default to empty until real monitoring is connected.
- Public endpoint: `GET /api/status`.
- Public page: `/status`.

## Future migration path to DynamoDB

1. Create a dedicated status table (for example `StatusPublicTable`) scoped for public-safe records only.
2. Add typed repository methods equivalent to:
   - component status reads/writes
   - incident create/update/resolve
   - maintenance create/update/complete/cancel
   - uptime metric ingestion from approved monitoring data
3. Add server-side validation for all write payloads (Zod schema in shared package).
4. Keep read model strictly public-safe and omit internal diagnostics.
5. Preserve 90-day incident history filtering in the read service.

## Proposed admin roles allowed to publish status

- Platform Superadmin (primary owner)
- Designated Operations Lead (secondary owner)
- Optional Incident Commander role (time-bound access only)

## Audit logging requirements

- Every status write must emit an audit event with:
  - actor identity
  - timestamp
  - before/after values
  - reason code (incident, maintenance, correction)
  - approval metadata where required
- Retain immutable audit trail and export capability for incident review.

## Approval rule for major outage posts

- Require two-person approval before posting `major_outage` publicly:
  - Incident Commander (or Platform Superadmin)
  - Security/Ops approver
- Emergency bypass must be logged and reviewed post-incident.

## Public data safety rule

- Never include agency-specific, caller-specific, customer-specific, or incident transcript data on the public status page.
- Never publish secrets, auth details, stack traces, internal hostnames, or security implementation details.
