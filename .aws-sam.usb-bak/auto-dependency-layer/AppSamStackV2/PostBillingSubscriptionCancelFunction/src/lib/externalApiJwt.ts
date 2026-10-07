import { SignJWT, jwtVerify } from "jose";
import { getExternalApiJwtSigningKey } from "./externalApiJwtSecret.js";

const ISS = "rapid-cortex/agency-api";
const AUD = "rapid-cortex/v1";

export type ExternalApiClaims = {
  sub: string;
  /** Cognito-independent agency partition */
  cid: string;
  /** Space-delimited scopes */
  scopes: string;
  env: "sandbox" | "production";
};

export async function signExternalAccessToken(claims: ExternalApiClaims, ttlSeconds = 3600): Promise<string> {
  const key = await getExternalApiJwtSigningKey();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    cid: claims.cid,
    scopes: claims.scopes,
    env: claims.env,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISS)
    .setAudience(AUD)
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
}

export async function verifyExternalAccessToken(token: string): Promise<ExternalApiClaims> {
  const key = await getExternalApiJwtSigningKey();
  const { payload } = await jwtVerify(token, key, { issuer: ISS, audience: AUD });
  const sub = String(payload.sub ?? "");
  const cid = String((payload as { cid?: string }).cid ?? "");
  const scopes = String((payload as { scopes?: string }).scopes ?? "");
  const envClaim = (payload as { env?: string }).env;
  if (!sub || !cid) throw new Error("INVALID_TOKEN");
  if (envClaim !== "sandbox" && envClaim !== "production") throw new Error("INVALID_TOKEN");
  return { sub, cid, scopes, env: envClaim };
}
