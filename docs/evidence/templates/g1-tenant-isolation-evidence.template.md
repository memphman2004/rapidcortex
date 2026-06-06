# G1: Tenant isolation & authentication — evidence template

**Date:** _YYYY-MM-DD_  
**Environment:** _staging / production_  
**Tested by:** _Name_  
**Reviewed by:** _Name_

## Automated tests (attach CI or local log)

- Command: `npm run test:security`
- Scope: JWT/anonymous fail-closed, cross-tenant isolation, RBAC (`apps/api/src/__tests__/security/`).

## Manual / environment proofs (required for GREEN)

- [ ] Live `401` / `403` matrix against deployed API (missing JWT, invalid JWT, cross-agency ID).
- [ ] Penetration or claim-validation notes for customer jurisdiction (if required).
- [ ] RC Lite vs dashboard separation (where applicable).

## Sign-offs

- [ ] Engineering lead — date: ___
- [ ] Security lead — date: ___

**Gate status:** _Do not mark GREEN until rows above are complete._
