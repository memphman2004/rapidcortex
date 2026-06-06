# 06 - Audit Scenario Tests (End-to-End)

## Objective

Run and document at least five end-to-end scenarios that exercise gate-critical behavior.

## Command Executed

```bash
npm run test:validation
```

## Scenarios Executed

From `apps/web/__tests__/validation/*`:

1. **System config validation**
   - Runtime configuration presence verified.
2. **Backend health contract**
   - `/api/health` response contract validated.
3. **CAD write-path safety**
   - `POST /api/cad/incidents` remains blocked by safety controls.
4. **Route contract: triage/transcription/language/intake**
   - Critical read-only pilot pathways respond without `notConfigured` contract fallback.
5. **Readiness gate integrity**
   - Hard gate and release signoff content assertions pass for `docs/customer-readiness-gate.md`.

Additional route contract scenarios also executed for:

- media
- command
- qa
- reliability
- text-to-voice

## Output Summary

```text
Test Files  3 passed (3)
Tests      19 passed (19)
```

## Status

- **Pass** for automated scenario coverage available in repository.
- For customer-specific audit evidence, add authenticated staging scenarios with pilot tenant users.
