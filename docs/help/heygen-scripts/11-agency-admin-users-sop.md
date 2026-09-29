# 11 — Agency Admin: users, roles, SOP library

| Field | Value |
|---|---|
| Video ID | `psap-admin-users-sop` |
| Audience | Agency Admin, Agency IT |
| Target length | 8:00 |
| Tone | Governance; least privilege |

## On-screen cues

1. Agency Admin console (not dispatcher workspace)
2. Users → invite → role picker
3. Deactivate (not delete)
4. SOP Library upload / retire
5. Callout: no `commsupervisor`; CAD write-back fail-closed
6. MFA policy reminder

## Narration (HeyGen)

Agency Admin manages users, the SOP library, integrations, retention, and billing for your tenant. You do not work live nine-one-one calls from this console. Landing on the dispatcher live workspace as Agency Admin is an operational separation failure.

Start with users. Open Users. Invite the work email your agency uses. Assign a canonical role only — dispatcher, supervisor, agency I-T, analyst, auditor, and other supported values. Do not invent role strings. Do not use the deprecated token “commsupervisor” — use supervisor. Have the user sign out and sign in after a role change so the token refreshes. Verify they land on the correct post-login route.

When someone leaves, deactivate the same day. Do not delete the record. Access ends; audit history remains. Never share logins.

Next, the SOP library. Upload the current approved package. Tag call types so Protocol A-I can match grounded content. Retire superseded versions. A-I must not fabricate steps beyond your library.

With Agency I-T, keep CAD write-back fail-closed until U-A-T and written authorization. Enforce M-F-A for interactive seats. Review retention with your records officer.

Your job is configuration, access, and governance — so dispatchers can trust the system under pressure.
