import "server-only";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveBffBearerToken, applyRotatedAuthCookies } from "@/lib/server/bff-auth-token";

/**
 * Invoke GenerateGrantPackage Lambda directly (RequestResponse).
 * Bypasses API Gateway's hard 30s HTTP integration limit so rare grant
 * packages can use the full ~60s Anthropic budget.
 */
export async function invokeGrantGenerateLambda(request: NextRequest): Promise<NextResponse> {
  const functionName = process.env.GRANT_GENERATE_FUNCTION_NAME?.trim();
  if (!functionName) {
    return NextResponse.json(
      { error: "GRANT_GENERATE_FUNCTION_NAME is not configured on the web container" },
      { status: 503 },
    );
  }

  const auth = await resolveBffBearerToken(request);
  if (!auth.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyBuf = await request.arrayBuffer();
  const bodyText = bodyBuf.byteLength ? Buffer.from(bodyBuf).toString("utf8") : "{}";

  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.COGNITO_REGION?.trim() ||
    process.env.NEXT_PUBLIC_COGNITO_REGION?.trim() ||
    "us-east-1";

  const client = new LambdaClient({ region });
  const payload = {
    version: "2.0",
    routeKey: "POST /api/platform/grant-generate",
    rawPath: "/api/platform/grant-generate",
    headers: {
      authorization: `Bearer ${auth.token}`,
      "content-type": request.headers.get("content-type") || "application/json",
    },
    requestContext: {
      http: { method: "POST", path: "/api/platform/grant-generate" },
    },
    isBase64Encoded: false,
    body: bodyText,
  };

  let out;
  try {
    out = await client.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(payload), "utf8"),
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[grant-generate-invoke] Lambda invoke failed:", msg);
    return NextResponse.json({ error: "Grant generation invoke failed" }, { status: 502 });
  }

  if (out.FunctionError) {
    const errPayload = out.Payload ? Buffer.from(out.Payload).toString("utf8") : "";
    console.error("[grant-generate-invoke] FunctionError:", out.FunctionError, errPayload.slice(0, 500));
    return NextResponse.json({ error: "Grant generation failed" }, { status: 502 });
  }

  const raw = out.Payload ? Buffer.from(out.Payload).toString("utf8") : "";
  let parsed: { statusCode?: number; body?: string; headers?: Record<string, string> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    console.error("[grant-generate-invoke] Non-JSON Lambda payload");
    return NextResponse.json({ error: "Invalid grant generation response" }, { status: 502 });
  }

  const status = typeof parsed.statusCode === "number" ? parsed.statusCode : 200;
  const responseHeaders = new Headers();
  const ct = parsed.headers?.["content-type"] || parsed.headers?.["Content-Type"] || "application/json";
  responseHeaders.set("content-type", ct);

  const response = new NextResponse(parsed.body ?? "{}", { status, headers: responseHeaders });
  if ("rotated" in auth && auth.rotated) {
    applyRotatedAuthCookies(response, auth.rotated);
  }
  return response;
}

export function canInvokeGrantGenerateLambda(): boolean {
  return Boolean(process.env.GRANT_GENERATE_FUNCTION_NAME?.trim());
}
