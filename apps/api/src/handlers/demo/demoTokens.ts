import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * Token format matches apps/web/src/demo/tokens/demo-token.ts.
 * The signing key is read from Secrets Manager. A raw key is accepted only
 * from DEMO_TOKEN_SIGNING_SECRET for local tests — never commit that value.
 */
const SECRET_ID = process.env.DEMO_TOKEN_SECRET_ID?.trim() || "rapid-cortex/demo/token-signing-key";
const secrets = new SecretsManagerClient({});

export interface DemoTokenClaimsNode {
  v: 1;
  scenarioId: string;
  offsetSeconds: number;
  tourStop: string;
  exp: number;
  iss: string;
  jti: string;
}

function canonical(claims: DemoTokenClaimsNode): string {
  return JSON.stringify({
    v: 1,
    scenarioId: claims.scenarioId,
    offsetSeconds: claims.offsetSeconds,
    tourStop: claims.tourStop,
    exp: claims.exp,
    iss: claims.iss,
    jti: claims.jti,
  });
}

export function signDemoTokenNode(claims: DemoTokenClaimsNode, secret: string): string {
  const encoded = Buffer.from(canonical(claims), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyDemoTokenNode(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): { ok: true; claims: DemoTokenClaimsNode } | { ok: false; reason: "invalid" | "expired" | "unconfigured" } {
  if (!secret) return { ok: false, reason: "unconfigured" };
  const [encoded, presented] = token.split(".");
  if (!encoded || !presented || token.split(".").length !== 2) return { ok: false, reason: "invalid" };
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false, reason: "invalid" };
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DemoTokenClaimsNode;
    if (claims.v !== 1 || !claims.scenarioId || !claims.jti) return { ok: false, reason: "invalid" };
    if (claims.exp <= now) return { ok: false, reason: "expired" };
    return { ok: true, claims };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

async function signingSecret(): Promise<string> {
  const fromEnv = process.env.DEMO_TOKEN_SIGNING_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const raw = result.SecretString?.trim() ?? "";
  if (!raw) throw new Error("Demo token signing secret is empty");
  if (raw.startsWith("{")) {
    const parsed = JSON.parse(raw) as { secret?: string };
    if (!parsed.secret) throw new Error("Demo token signing secret JSON is missing secret");
    return parsed.secret;
  }
  return raw;
}

function json(status: number, body: Record<string, unknown>) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const secret = await signingSecret();
    const body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
    const action = String(body.action ?? "issue");
    if (action === "verify") {
      const verdict = verifyDemoTokenNode(String(body.token ?? ""), secret);
      console.log(JSON.stringify({ level: "audit", source: "demo-token-lambda", event: "demo_token_verify", ok: verdict.ok }));
      return json(verdict.ok ? 200 : 401, verdict.ok ? { ok: true, claims: verdict.claims } : { ok: false, reason: verdict.reason });
    }
    const now = Math.floor(Date.now() / 1000);
    const claims: DemoTokenClaimsNode = {
      v: 1,
      scenarioId: String(body.scenarioId ?? ""),
      offsetSeconds: Number(body.offsetSeconds ?? 0),
      tourStop: String(body.tourStop ?? ""),
      exp: now + Number(body.expiresInSeconds ?? 7 * 24 * 60 * 60),
      iss: String(body.issuer ?? "sales"),
      jti: crypto.randomUUID(),
    };
    if (!claims.scenarioId.startsWith("demo-")) return json(400, { error: "scenario must be a demo scenario" });
    const token = signDemoTokenNode(claims, secret);
    console.log(JSON.stringify({
      level: "audit",
      source: "demo-token-lambda",
      event: "demo_token_issued",
      jti: claims.jti,
      scenarioId: claims.scenarioId,
      issuer: claims.iss,
    }));
    return json(200, { token, jti: claims.jti, exp: claims.exp });
  } catch (error) {
    console.log(JSON.stringify({
      level: "error",
      source: "demo-token-lambda",
      event: "demo_token_failed",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return json(500, { error: "demo_token_failed" });
  }
};
