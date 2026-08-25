import { NextRequest, NextResponse } from "next/server";
import { joinUpstreamApiUrl, normalizeUpstreamApiPath } from "@/lib/upstream-url";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { resolveBffBearerToken, applyRotatedAuthCookies } from "@/lib/server/bff-auth-token";
import { isRmsUiEnabled } from "@/lib/runtime-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * POST /api/rms/reports/generate
 * Proxies to Lambda (sync JSON) and wraps the response as SSE for the browser —
 * same pattern as the grant writer (progress → complete | error).
 */
export async function POST(request: NextRequest) {
  if (!isRmsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const path = normalizeUpstreamApiPath("/api/rms/reports/generate");
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE_3 is not configured for RMS routes" },
      { status: 503 },
    );
  }

  const auth = await resolveBffBearerToken(request);
  if (!auth.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.arrayBuffer();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      };

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          /* closed */
        }
      }, 15_000);

      try {
        send("progress", {
          message: "Generating your incident report — please stay on this page.",
        });

        const target = joinUpstreamApiUrl(base, path);
        const upstream = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": request.headers.get("content-type") ?? "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: body.byteLength ? body : undefined,
          cache: "no-store",
        });

        if (!upstream.ok) {
          const err = (await upstream.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Server error ${upstream.status}`);
        }

        const data = (await upstream.json()) as { report: unknown };
        send("complete", { report: data.report });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        clearInterval(keepalive);
        controller.close();
      }
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  if (auth.token && "rotated" in auth && auth.rotated) {
    applyRotatedAuthCookies(response, auth.rotated);
  }

  return response;
}
