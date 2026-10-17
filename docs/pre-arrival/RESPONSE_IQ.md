# Pre-Arrival iQ / Response iQ

Caller-facing guidance surface under Caller Media B.5. Distinct from Silent Text (`/silent-text/*`) and Pinpoint.

## Instruction hierarchy

1. Agency `modePolicy.sopSteps` matching the CAD nature pattern (`*` suffix wildcard)
2. Built-in protocol library defaults (cardiac, choking, fire, generic medical)
3. Generic fallback: stay calm, keep phone nearby, unlock door if safe

## Stay on line

When `modePolicy.stayOnLine` is true, the public caller page shows a persistent banner:

> Your dispatcher is on the line — keep this call open.

## Surfaces

| Surface | Path |
|---------|------|
| Public caller | `/pre-arrival/[token]` |
| Dispatcher panel | Module dock → Pre-Arrival iQ |
| API (stack 5) | `/api/incidents/{id}/pre-arrival/*`, `/api/public/pre-arrival/{token}` |

## Feature flags

- Web: `NEXT_PUBLIC_ENABLE_PRE_ARRIVAL_IQ` (default **on** when unset)
- API: `ENABLE_PRE_ARRIVAL_IQ` (default **on** when unset)
