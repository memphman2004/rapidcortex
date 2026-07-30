# Ring certification — submit runbook

Complete in order. This closes the portal + ops gaps for **Start review process**.

## Package files

| File | Use |
|------|-----|
| [PRIVACY_LEGAL_QUESTIONNAIRE.md](./PRIVACY_LEGAL_QUESTIONNAIRE.md) | Paste into Certify → Privacy & Legal (5 tabs) |
| [REVIEWER_NOTES.md](./REVIEWER_NOTES.md) | Paste into Certify → Add notes (3 fields) |
| [../ring-certification-reviewer-guide.md](../ring-certification-reviewer-guide.md) | Human E2E script during review |

---

## A. Portal configuration (once)

In Amazon / Ring Developer Portal → Rapid Cortex Connect → Account linking:

**Production settings**

| Field | Value |
|-------|-------|
| Account Link | `https://www.rapidcortex.us/connect/ring/link` |
| App Homepage | `https://www.rapidcortex.us/connect/ring/start` |
| Token Exchange | `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/token-exchange` |
| Webhook | `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/webhook` |

**Staging settings:** copy the same four URLs (single live backend; satisfies “tested staging and production endpoints” attestation when you run Appstore Test mode + production Install).

Confirm listing: privacy + terms + support links; screenshots; description in plain language.

---

## B. Portal Certify form

1. Open **Certify**.
2. Complete **Privacy & Legal questionnaire** using `PRIVACY_LEGAL_QUESTIONNAIRE.md` → Save and submit.
3. **Add notes** using the three blocks in `REVIEWER_NOTES.md` → Save.
4. Dry-run account linking once via portal Test/staging mode and once via production Get App (same URLs).
5. Check the acknowledgment:

   > I have tested my app in staging environment. I was able to test the account-linking workflow with both my staging and production endpoints…

6. Click **Start review process**.

Estimated review: 1–2 business days (public-safety use cases may take longer).

---

## C. Ops pre-submit checklist (must be green)

- [ ] Marketing site deployed with latest `/connect/ring/link` + `/connect/ring/start` (Create Account emphasis + privacy/deletion section)
- [ ] `ring-reviewer@rapidcortex.us` signs in at `/test-agency/media`
- [ ] Appstore link works end-to-end (Connected in Ring)
- [ ] ≥1 device with **GPS** + **Enabled for Connect**
- [ ] Incident at that address returns the camera at 500m
- [ ] SMS Allow / Decline / Stop open HTML confirmation pages
- [ ] Live stream opens; End Access works
- [ ] Legal URLs return HTTP 200 (privacy, terms, contact, start, link)
- [ ] Token Exchange + Webhook URLs registered (table above)
- [ ] Do **not** instruct reviewers to use Media → Connect Ring Account

GPS seed if needed:

```bash
STAGE=dev AGENCY_ID=test-agency DEVICE_NAME_CONTAINS=Living \
  npx tsx scripts/seed-ring-sonoma-point-gps.ts
```

Reviewer Cognito seed (if account missing):

```bash
npx tsx scripts/seed-role-test-users.ts
# ensure ring-reviewer@rapidcortex.us / test-agency / dispatcher
```

---

## D. During review

- Keep endpoints up; do not change portal URLs.
- Monitor Stack 4 Lambda logs for token-exchange, webhook, homeowner-link.
- Respond quickly to Ring feedback.

## E. What this repo cannot click for you

Submitting **Start review process** requires your Ring Developer Portal login. Everything else for a clean submit is prepared in this folder.
