/**
 * Build Cognito Hosted UI `/oauth2/authorize` URL (authorization code + PKCE).
 */
export function buildCognitoAuthorizeUrl(input: {
  authorizeEndpoint: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  state: string;
  scopes: string[];
  responseType: "code";
  /** e.g. `none` for silent SSO when the Cognito domain already has an active browser session */
  prompt?: string;
}): string {
  const u = new URL(input.authorizeEndpoint);
  u.searchParams.set("client_id", input.clientId);
  u.searchParams.set("response_type", input.responseType);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("scope", input.scopes.join(" "));
  u.searchParams.set("code_challenge_method", input.codeChallengeMethod);
  u.searchParams.set("code_challenge", input.codeChallenge);
  u.searchParams.set("state", input.state);
  if (input.prompt?.trim()) {
    u.searchParams.set("prompt", input.prompt.trim());
  }
  return u.toString();
}
