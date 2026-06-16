import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { jsonStatus, unauthorized } from "../lib/response.js";
import {
  nestAccountLinkUrl,
  nestBuildOAuthUrl,
  nestHandleCallback,
  RCError,
} from "../integrations/cameras/nest-oauth.js";

const nestConnectBodySchema = z
  .object({
    projectId: z.string().min(1).max(120),
    clientId: z.string().min(1).max(320),
  })
  .strict();

function providersTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "cameras" && parts[i + 1] === "providers");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function redirect(url: string, statusCode = 302) {
  return {
    statusCode,
    headers: { location: url },
    body: "",
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  const tail = providersTail(event.rawPath ?? "");

  // OAuth callback — Google redirect, no JWT
  if (method === "GET" && tail[0] === "nest" && tail[1] === "callback") {
    const code = event.queryStringParameters?.code?.trim() ?? "";
    const state = event.queryStringParameters?.state?.trim() ?? "";
    const linkBase = nestAccountLinkUrl();

    if (!code || !state) {
      return redirect(`${linkBase}?nest=error`);
    }

    try {
      await nestHandleCallback(code, state);
      return redirect(`${linkBase}?nest=connected`);
    } catch (err) {
      console.error("[nest/callback]", err);
      return redirect(`${linkBase}?nest=error`);
    }
  }

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const pwd = operationalPasswordBlock(user);
  if (pwd) return pwd;

  try {
    if (method === "POST" && tail[0] === "nest" && tail[1] === "connect") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = nestConnectBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) {
        return jsonStatus({ error: "projectId and clientId are required" }, 400);
      }

      const { oauthUrl, state } = await nestBuildOAuthUrl(
        user.agencyId,
        parsed.data.projectId.trim(),
        parsed.data.clientId.trim(),
      );

      return jsonStatus({ oauthUrl, state }, 200);
    }

    if (method === "GET" && tail.length === 0) {
      return jsonStatus(
        {
          providers: [{ id: "nest", label: "Google Nest", connectPath: "/api/cameras/providers/nest/connect" }],
        },
        200,
      );
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (err) {
    if (err instanceof RCError) {
      return jsonStatus({ error: err.message }, err.statusCode);
    }
    console.error("[cameras/providers]", err);
    return jsonStatus({ error: "Internal error" }, 500);
  }
};
