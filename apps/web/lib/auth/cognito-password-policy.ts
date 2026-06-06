/**
 * Matches `AWS::Cognito::UserPool` password policy in `infra/template.yaml`
 * (MinimumLength 12 + upper, lower, number, symbol).
 */
export const COGNITO_PASSWORD_REQUIREMENTS =
  "At least 12 characters with uppercase, lowercase, a number, and a symbol.";

export function isValidCognitoPassword(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export function cognitoPasswordPolicyError(): string {
  return `Password does not meet requirements: ${COGNITO_PASSWORD_REQUIREMENTS}`;
}
