# SOP — HR onboarding and offboarding (production access)

**TSC:** CC1.4, CC6.2, CC6.3  
**Policy:** [POL-12](../policies/12-hr-security-awareness.md)

PII (SSN, background reports, home address) stays in HR systems.

## Joiner (before prod access)

1. Ticket `access-joiner-<id>`.
2. Manager names roles: AWS IAM, Cognito groups, Git, vendor consoles.
3. Security awareness + POL-02 acknowledgement.
4. Unique IAM user or SSO role; MFA enrolled before first deploy.
5. Cognito user in the **correct** pool (`us-east-1_0z6tA6WBs` for live). MFA required by pool policy.
6. Log training date in [hr-training-log.md](../evidence/hr-training-log.md).

## Mover

New ticket; add new groups then remove old in the same change window.

## Leaver

1. Disable Cognito (`AdminDisableUser`) same day for involuntary; by last day for voluntary.
2. Deactivate IAM access keys; console login disabled.
3. Remove from Git forge and password manager.
4. Rotate secrets the person could retrieve (billing/SES, AI keys if they had console) — follow rotation SOP, do not put values in the ticket.
5. Collect laptop.
6. Confirm on next quarterly access review.

Template: [hr-onboarding.template.md](../../../evidence/templates/soc2/hr-onboarding.template.md).
