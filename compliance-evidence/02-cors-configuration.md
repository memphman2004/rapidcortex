# 02 - CORS Configuration by Environment

## Source

- `infra/template.yaml`

## Current IaC Controls

- Parameter: `HttpApiCorsAllowedOrigins` (default `*` for local/dev convenience)
- API config:
  - `Api -> Properties -> CorsConfiguration -> AllowOrigins: !Split [",", !Ref HttpApiCorsAllowedOrigins]`
  - Allowed methods: `GET, POST, PATCH, PUT, DELETE, OPTIONS`
  - Allowed headers: `authorization, content-type`
- Rule guardrails:
  - `PilotProdNoCorsWildcard` blocks `*` for `staging`, `pilot`, and `prod`

## Environment Mapping

- **dev**
  - Allowed to use wildcard `*` for local development.
  - Current CJIS report confirms wildcard in development profile.
- **staging**
  - Must use explicit origin allowlist (no wildcard).
- **pilot**
  - Must use explicit origin allowlist (no wildcard).
- **prod**
  - Must use explicit origin allowlist (no wildcard).

## Evidence

- `infra/template.yaml` lines covering:
  - `HttpApiCorsAllowedOrigins` parameter definition
  - `PilotProdNoCorsWildcard` rule
  - `Api.CorsConfiguration.AllowOrigins`

## Status

- Policy is codified in IaC.
- Pilot/prod deploy parameters must provide explicit origins to pass readiness gate.
