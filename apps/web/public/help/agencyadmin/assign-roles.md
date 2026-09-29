# Assigning & Changing Roles

Roles are stored as Cognito `custom:role` values. Wrong roles break routing and RBAC.

## How to change a role

1. Open **Users** → select the account.
2. Set the new role from the supported list only.
3. Save and have the user sign out / sign in so the JWT refreshes.
4. Verify they land on the correct post-login route (dispatcher dashboard vs supervisor vs admin).

## Do not

- Use deprecated `commsupervisor` — use `supervisor`
- Assign product-vertical roles (`VENUE_*`, `CAMPUS_*`) to PSAP seats unless that person truly works that product
- Elevate to Agency Admin casually — least privilege
