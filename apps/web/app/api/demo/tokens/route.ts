import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import { canAuthorDemoSession } from "@/src/demo/tokens/demo-link-paths";
import { createDemoTokenClaims, signDemoToken, verifyDemoToken } from "@/src/demo/tokens/demo-token";
import { getScenario } from "@/src/demo/scenarios/registry";
import { getDemoTokenStore, isDemoTokenRevoked } from "@/src/demo/tokens/token-store";

export const runtime = "nodejs";

function secret(): string {
  return process.env.DEMO_TOKEN_SIGNING_SECRET?.trim() ?? "";
}

function audit(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "audit", source: "demo-token", event, ...fields }));
}

async function authorId(): Promise<string | null> {
  if (process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return "demo-instance";
  }
  const token = (await cookies()).get(COOKIE_ID_TOKEN)?.value;
  if (!token) return null;
  const user = await verifyCognitoIdToken(token);
  if (!user || !canAuthorDemoSession(String(user.role))) return null;
  return user.userId;
}

export async function GET() {
  const author = await authorId();
  if (!author) return NextResponse.json({ error: "Not allowed to view demo links" }, { status: 403 });
  const store = getDemoTokenStore();
  return NextResponse.json({ issued: store.listIssued(), uses: store.listUses() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        scenarioId?: string;
        issuer?: string;
        expiresInDays?: number;
        offsetSeconds?: number;
        tourStop?: string;
        jti?: string;
        token?: string;
      }
    | null;
  if (!body?.action) return NextResponse.json({ error: "action is required" }, { status: 400 });

  if (body.action === "use") {
    const signingSecret = secret();
    if (!signingSecret || !body.token) return NextResponse.json({ error: "token is required" }, { status: 400 });
    const verdict = await verifyDemoToken(body.token, signingSecret, { isRevoked: isDemoTokenRevoked });
    if (!verdict.ok) return NextResponse.json({ error: verdict.reason }, { status: 401 });
    getDemoTokenStore().recordUse({
      jti: verdict.claims.jti,
      scenarioId: verdict.claims.scenarioId,
      at: Date.now(),
    });
    audit("demo_token_used", { jti: verdict.claims.jti, scenarioId: verdict.claims.scenarioId });
    return NextResponse.json({ ok: true });
  }

  const author = await authorId();
  if (!author) return NextResponse.json({ error: "Not allowed to manage demo links" }, { status: 403 });
  const store = getDemoTokenStore();

  if (body.action === "revoke") {
    if (!body.jti) return NextResponse.json({ error: "jti is required" }, { status: 400 });
    store.revoke(body.jti);
    audit("demo_token_revoked", { jti: body.jti, by: author });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "revoke-issuer") {
    if (!body.issuer) return NextResponse.json({ error: "issuer is required" }, { status: 400 });
    store.revokeIssuer(body.issuer);
    audit("demo_token_issuer_revoked", { issuer: body.issuer, by: author });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "issue") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const signingSecret = secret();
  if (!signingSecret) {
    return NextResponse.json({ error: "demo_token_signing_secret_not_configured" }, { status: 503 });
  }
  const scenarioId = body.scenarioId?.trim() ?? "";
  if (!getScenario(scenarioId)?.enabled) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }
  const days = body.expiresInDays && body.expiresInDays > 0 ? body.expiresInDays : 7;
  const claims = createDemoTokenClaims({
    scenarioId,
    issuer: body.issuer?.trim() || author,
    offsetSeconds: body.offsetSeconds,
    tourStop: body.tourStop,
    expiresInSeconds: days * 24 * 60 * 60,
  });
  const token = await signDemoToken(claims, signingSecret);
  store.remember({
    jti: claims.jti,
    iss: claims.iss,
    scenarioId: claims.scenarioId,
    exp: claims.exp,
    createdAt: Date.now(),
  });
  audit("demo_token_issued", { jti: claims.jti, scenarioId, issuer: claims.iss });
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    token,
    jti: claims.jti,
    expiresAt: claims.exp,
    url: `${origin}/demo-link/s/${encodeURIComponent(token)}`,
  });
}
