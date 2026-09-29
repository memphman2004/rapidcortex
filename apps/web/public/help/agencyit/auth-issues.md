# User Login & Auth Issues

## Common causes

- Wrong agency URL / bookmark to another tenant
- MFA device changed without re-enrollment
- Deactivated account still bookmarked
- Password / operational password policy blocks

## Troubleshooting steps

1. Confirm the user role and active status in **Users**.
2. Verify they use the correct agency sign-in URL.
3. Reset MFA enrollment only through approved Admin/IT flow.
4. Unlock / reset password per Cognito policy — never share temporary passwords in chat.
5. Have the user clear site data if an old session cookie points at the wrong environment.

Log the ticket with time, username (not password), and correlation ID when the UI shows one.
