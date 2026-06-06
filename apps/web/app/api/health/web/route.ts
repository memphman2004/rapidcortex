import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Explicit Next.js frontend liveness. Does **not** call the Lambda/API — use `GET /api/health/upstream`.
 */
export async function GET() {
  const heap = process.memoryUsage();
  const healthData = {
    status: "healthy",
    service: "rapid-cortex-web",
    component: "next-js-frontend",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "unknown",
    environment: process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "unknown",
    uptime: process.uptime(),
    memory: {
      used: Math.round(heap.heapUsed / 1024 / 1024),
      total: Math.round(heap.heapTotal / 1024 / 1024),
    },
  };

  return NextResponse.json(healthData, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
