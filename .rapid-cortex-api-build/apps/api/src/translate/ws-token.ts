import { SignJWT, jwtVerify } from "jose";
import { env } from "../lib/env.js";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";

const ISS = "rapid-cortex/translate-ws";
const AUD = "rapid-cortex/translate";

export type TranslateWsClaims = {
  sub: string;
  agencyId: string;
  sessionId: string;
  wsRole: "officer" | "monitor";
};

async function signingKey(): Promise<Uint8Array> {
  const secret = await resolvePlainOrSecretArn(env.translateWsSecret, env.translateWsSecretArn);
  if (!secret) throw new Error("TRANSLATE_WS_SECRET_UNCONFIGURED");
  return new TextEncoder().encode(secret);
}

export async function signTranslateWsToken(claims: TranslateWsClaims, ttlSeconds = 3600): Promise<string> {
  const key = await signingKey();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    agencyId: claims.agencyId,
    sessionId: claims.sessionId,
    wsRole: claims.wsRole,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISS)
    .setAudience(AUD)
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
}

export async function verifyTranslateWsToken(token: string): Promise<TranslateWsClaims> {
  const key = await signingKey();
  const { payload } = await jwtVerify(token, key, { issuer: ISS, audience: AUD });
  const sub = String(payload.sub ?? "");
  const agencyId = String((payload as { agencyId?: string }).agencyId ?? "");
  const sessionId = String((payload as { sessionId?: string }).sessionId ?? "");
  const wsRole = (payload as { wsRole?: string }).wsRole;
  if (!sub || !agencyId || !sessionId) throw new Error("INVALID_TRANSLATE_WS_TOKEN");
  if (wsRole !== "officer" && wsRole !== "monitor") throw new Error("INVALID_TRANSLATE_WS_TOKEN");
  return { sub, agencyId, sessionId, wsRole };
}
