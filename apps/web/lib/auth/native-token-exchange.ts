/** Build `application/x-www-form-urlencoded` body for Cognito native code exchange (no client secret). */
export function buildNativeTokenExchangeParams(input: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
}
