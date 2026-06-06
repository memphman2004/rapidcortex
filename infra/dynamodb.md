# Rapid Cortex DynamoDB Model (MVP)

## Incidents table

Tables are **per SAM stack**: CloudFormation assigns physical table names (no fixed `rapid-cortex-incidents` string in the template). Lambdas receive table names via `!Ref` environment variables from `infra/template.yaml`.  
Primary key:

- `incidentId` (PK)

GSI:

- `agencyId-createdAt-index`
  - PK: `agencyId`
  - SK: `createdAt`

## Transcripts table

Table: `rapid-cortex-transcripts`  
Primary key:

- `incidentId` (PK)
- `timestamp` (SK)

Also store `segmentId` in each item.

## Analyses table

Table: `rapid-cortex-analyses`  
Primary key:

- `incidentId` (PK)
- `createdAt` (SK)

## Audit table

Table: `rapid-cortex-audit`  
Primary key:

- `eventId` (PK)

Optional GSI:

- `agencyId-createdAt-index`
