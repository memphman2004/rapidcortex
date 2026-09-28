import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";

function extractIP(req: NextRequest): string {
  const cf = req.headers.get("cloudfront-viewer-address");
  if (cf) return cf.split(":")[0] ?? "unknown";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_ID_TOKEN)?.value;
    const user = token ? await verifyCognitoIdToken(token) : null;
    const ip = extractIP(req);
    const body = (await req.json()) as {
      action: "started" | "stopped" | "expired";
      email: string;
      durationMs?: number;
      pageUrl?: string;
    };
    const ts = new Date().toISOString();
    const userId = user?.email || body.email || "unknown";

    const table = process.env.VIOLATION_LOG_TABLE?.trim();
    if (table) {
      const dynamo = new DynamoDBClient({});
      await dynamo.send(
        new PutItemCommand({
          TableName: table,
          Item: marshall(
            {
              pk: `USER#${userId}`,
              sk: `DEMO#${ts}#${randomUUID().slice(0, 8)}`,
              gsi1pk: `IP#${ip}`,
              gsi1sk: ts,
              eventType: `demo_mode_${body.action}`,
              userId,
              ipAddress: ip,
              action: body.action,
              durationMs: body.durationMs ?? null,
              pageUrl: body.pageUrl ?? null,
              serverTimestamp: ts,
              ttl: Math.floor(Date.now() / 1000) + 365 * 86400,
            },
            { removeUndefinedValues: true },
          ),
        }),
      );
    } else {
      console.info(
        JSON.stringify({
          msg: "content_protection_demo_mode",
          userId,
          ip,
          action: body.action,
          durationMs: body.durationMs ?? null,
        }),
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "demo_mode_log_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
