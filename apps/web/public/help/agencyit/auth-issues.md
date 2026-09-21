# User login and auth issues

1. Confirm they use the agency URL, not another tenant slug.
2. Locked / too many attempts — unlock per Cognito/admin tools you have.
3. MFA — re-enrollment, not “turn it off.”
4. Wrong dashboard — `custom:role` must be a PSAP role for 911, `CAMPUS_*` for campus, `VENUE_*` for venue.

Capture `requestId` and time (UTC) for Rapid Cortex support.
