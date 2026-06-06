# Desktop Client Backend Integration

This document defines a single backend model shared across web, macOS, and Windows clients.

## Shared Backend Contract

- One Cognito user pool for all clients.
- One API base URL (API Gateway custom domain).
- Same JWT claims and backend authorization checks:
  - `custom:role`
  - `custom:agencyId`
  - `custom:status=active`
- Same signed media URL upload/download flow.

## Authentication Model

- Cognito authentication for all clients.
- Desktop apps use platform-secure token storage:
  - macOS Keychain
  - Windows protected credential storage (DPAPI or equivalent)
- No desktop-specific backend bypasses.
- No frontend-only role checks; backend remains source of authorization truth.

## API Requirements for All Clients

- Protected endpoints validate:
  - JWT signature
  - issuer
  - audience/client id
  - role constraints
  - tenant (`agencyId`) constraints
  - active account status
- Cross-agency data access denied by backend policy.

## Media and Sensitive Data

- Desktop and web both use signed URL flow for private media buckets.
- Signed URL TTL should remain short-lived.
- Object metadata should include `agencyId` and `incidentId`.
- No public S3 buckets or public object ACLs.

## Client Configuration Matrix

- Required values for web/macOS/windows:
  - `COGNITO_USER_POOL_ID`
  - `COGNITO_CLIENT_ID`
  - `COGNITO_REGION`
  - `API_BASE_URL`
  - `APP_ALLOWED_ORIGINS` (web and auth-proxy controls)

## Operational Guidance

- Keep desktop release channels independent from backend environments, but point to the same environment-specific API/Cognito pair.
- Do not create desktop-only APIs.
- Track desktop auth and API errors with the same audit/event taxonomy where feasible.

## CJIS Disclaimer

These integration controls are designed to support a CJIS-aligned posture but do not imply CJIS certification.
