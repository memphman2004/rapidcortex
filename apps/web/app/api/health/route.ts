import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Web container probe (ECS/ALB/CloudFront + Dockerfile HEALTHCHECK). Unauthenticated. */
export async function GET() {
  const healthData = {
    status: "healthy",
    service: "rapid-cortex-web",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    environment: process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "unknown",
    deploymentStage: process.env.DEPLOY_STAGE ?? "unknown",
    uptime: process.uptime(),
  };

  return NextResponse.json(healthData, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
