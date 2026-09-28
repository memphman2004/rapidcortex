import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { marshall } from "@aws-sdk/util-dynamodb";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";

const HIGH_RISK = new Set([
  "screen_share_started",
  "devtools_open",
  "keyboard_shortcut",
  "print_dialog",
]);

function extractIP(req: NextRequest): string {
  const cf = req.headers.get("cloudfront-viewer-address");
  if (cf) return cf.split(":")[0] ?? "unknown";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

/** Always 200 — never confirm logging to the actor. Soft-fails if table unset. */
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_ID_TOKEN)?.value;
    const user = token ? await verifyCognitoIdToken(token) : null;
    const ip = extractIP(req);
    const userId = user?.email || user?.userId || "unauthenticated";
    const serverTs = new Date().toISOString();

    const body = (await req.json()) as {
      violations?: Array<{
        eventType: string;
        keyCombo?: string;
        selectedText?: string;
        pageUrl: string;
        userAgent: string;
        timestamp: string;
      }>;
    };

    const violations = Array.isArray(body.violations) ? body.violations.slice(0, 25) : [];
    if (!violations.length) return NextResponse.json({ ok: true });

    const table = process.env.VIOLATION_LOG_TABLE?.trim();
    if (table) {
      const dynamo = new DynamoDBClient({});
      const ttl = Math.floor(Date.now() / 1000) + 90 * 86400;
      await dynamo.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [table]: violations.map((v) => ({
              PutRequest: {
                Item: marshall(
                  {
                    pk: `USER#${userId}`,
                    sk: `VIOLATION#${v.timestamp}#${randomUUID().slice(0, 8)}`,
                    gsi1pk: `IP#${ip}`,
                    gsi1sk: serverTs,
                    userId,
                    ipAddress: ip,
                    eventType: v.eventType,
                    keyCombo: v.keyCombo ?? null,
                    selectedText: v.selectedText ?? null,
                    pageUrl: v.pageUrl,
                    userAgent: v.userAgent,
                    clientTimestamp: v.timestamp,
                    serverTimestamp: serverTs,
                    ttl,
                  },
                  { removeUndefinedValues: true },
                ),
              },
            })),
          },
        }),
      );
    } else {
      console.info(
        JSON.stringify({
          msg: "content_protection_violation",
          userId,
          ip,
          count: violations.length,
          events: violations.map((v) => v.eventType),
        }),
      );
    }

    const isHighRisk = violations.some((v) => HIGH_RISK.has(v.eventType));
    try {
      const cw = new CloudWatchClient({});
      await cw.send(
        new PutMetricDataCommand({
          Namespace: "RapidCortex/Security",
          MetricData: [
            {
              MetricName: "ContentViolation",
              Value: violations.length,
              Unit: "Count",
              Dimensions: [
                { Name: "Event", Value: violations[0]?.eventType ?? "unknown" },
              ],
            },
            ...(isHighRisk
              ? [
                  {
                    MetricName: "HighRiskViolation",
                    Value: 1,
                    Unit: "Count" as const,
                  },
                ]
              : []),
          ],
        }),
      );
    } catch {
      /* metrics optional */
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "content_protection_log_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
