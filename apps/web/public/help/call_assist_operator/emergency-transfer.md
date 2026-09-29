# Emergency Transfer

When the Safety Engine / Lex emergency path fires:

1. AI talk stops immediately.
2. Amazon Connect transfers the **original caller leg** to the City-designated live answering point.
3. Do not continue the non-emergency interview or collect more form fields.
4. Confirm transfer completed in the session UI.
5. If telephony fails, escalate to Supervisor as P1 and use the backup voice path your agency published.

This path is fail-safe by design. Practice it in the Demo runner before go-live.
