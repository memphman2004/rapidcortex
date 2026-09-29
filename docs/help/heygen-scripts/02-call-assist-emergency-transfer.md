# 02 — Call Assist: emergency recognition & Connect transfer

| Field | Value |
|---|---|
| Video ID | `ca-emergency-transfer` |
| Audience | Call Assist Operator, Supervisor, Admin |
| Target length | 5:00 |
| Tone | Firm, fail-safe, zero ambiguity |

## On-screen cues

1. Title: “Emergency recognition & Connect transfer”
2. Demo: mid-call emergency disclosure (seeded scenario)
3. Highlight: A-I talk stops
4. Diagram: caller leg → Amazon Connect → City live answer point
5. P1 path if transfer fails
6. End: practice in Demo runner before go-live

## Narration (HeyGen)

This lesson is the most important Call Assist skill you will learn.

Call Assist is for non-emergency intake only. When a caller discloses an emergency — or the Safety Engine and Lex emergency path detect one — the product must fail safe.

Here is what should happen. A-I talk stops immediately. Amazon Connect transfers the original caller leg to the City-designated live answering point. You do not continue the non-emergency interview. You do not collect more form fields. You do not “just finish this question.”

In the session UI, confirm the transfer completed. If telephony fails, treat it as priority one. Escalate to your Call Assist supervisor and use the backup voice path your agency published.

Practice this in the Demo runner using a seeded mid-call emergency scenario before you take live traffic. Know the transfer destination for your city. Know who to page when Connect misbehaves.

Remember: Call Assist never replaces nine-one-one, CAD, or dispatcher authority. Emergency transfer exists so a non-emergency bot never traps a caller who needs a live telecommunicator.

When in doubt, get the caller to a human on the emergency path. That is success.
