import "server-only";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { NextRequest } from "next/server";
import type { CognitoRefreshTokens } from "@/lib/auth/cognito-refresh";
import { resolveBffBearerToken } from "@/lib/server/bff-auth-token";

export type GrantWriterInvokeResult =
  | { ok: true; sections: Record<string, unknown>; rotated?: CognitoRefreshTokens }
  | { ok: false; status: number; error: string; rotated?: CognitoRefreshTokens };

/**
 * Invoke GrantWriterHttp Lambda directly (RequestResponse).
 * Bypasses API Gateway's 30s HTTP cap so Claude can use the 180s Lambda budget.
 * Anthropic credentials stay in Secrets Manager on the Lambda — not on ECS.
 */
export async function invokeGrantWriterLambda(
  request: NextRequest,
  bodyText = "{}",
): Promise<GrantWriterInvokeResult> {
  const functionName = process.env.GRANT_WRITER_FUNCTION_NAME?.trim();
  if (!functionName) {
    return { ok: false, status: 503, error: "GRANT_WRITER_FUNCTION_NAME is not configured on the web container" };
  }

  const auth = await resolveBffBearerToken(request);
  if (!auth.token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const rotated = "rotated" in auth && auth.rotated ? auth.rotated : undefined;

  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.COGNITO_REGION?.trim() ||
    process.env.NEXT_PUBLIC_COGNITO_REGION?.trim() ||
    "us-east-1";

  const client = new LambdaClient({ region });
  const payload = {
    version: "2.0",
    routeKey: "POST /api/rc-admin/grant-writer/generate",
    rawPath: "/api/rc-admin/grant-writer/generate",
    headers: {
      authorization: `Bearer ${auth.token}`,
      "content-type": request.headers.get("content-type") || "application/json",
    },
    requestContext: {
      http: { method: "POST", path: "/api/rc-admin/grant-writer/generate" },
    },
    isBase64Encoded: false,
    body: bodyText,
  };

  try {
    const out = await client.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(payload), "utf8"),
      }),
    );
    if (out.FunctionError) {
      const errPayload = out.Payload ? Buffer.from(out.Payload).toString("utf8") : "";
      console.error("[grant-writer-invoke] FunctionError:", out.FunctionError, errPayload.slice(0, 500));
      return { ok: false, status: 502, error: "Grant generation failed", rotated };
    }
    const raw = out.Payload ? Buffer.from(out.Payload).toString("utf8") : "";
    const parsed = JSON.parse(raw) as { statusCode?: number; body?: string };
    const status = typeof parsed.statusCode === "number" ? parsed.statusCode : 200;
    const body = parsed.body ? (JSON.parse(parsed.body) as { sections?: Record<string, unknown>; error?: string }) : {};
    if (status >= 400 || !body.sections) {
      return { ok: false, status, error: body.error ?? "Grant generation failed", rotated };
    }
    return { ok: true, sections: body.sections, rotated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[grant-writer-invoke] Lambda invoke failed:", msg);
    return { ok: false, status: 502, error: "Grant generation invoke failed", rotated };
  }
}

export function canInvokeGrantWriterLambda(): boolean {
  return Boolean(process.env.GRANT_WRITER_FUNCTION_NAME?.trim());
}
