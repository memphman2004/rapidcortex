import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/**
 * Link-preview rotator for marketing shares (email / iMessage / social).
 * Returns PNG bytes for one of three branded assets, alternating by wall clock.
 */
const SHARE_PATHS = [
  "/Logo/share/alt3-rapid.png",
  "/Logo/share/911-marketing.png",
  "/Logo/share/flag-dispatch.png",
] as const;

const SITE_ORIGIN = (process.env.MARKETING_SITE_ORIGIN ?? "https://www.rapidcortex.us").replace(
  /\/$/,
  "",
);

export const handler: APIGatewayProxyHandlerV2 = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  const path = SHARE_PATHS[Math.floor(Date.now() / 1000) % SHARE_PATHS.length]!;
  const upstream = await fetch(`${SITE_ORIGIN}${path}`);
  if (!upstream.ok) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: `Upstream share image failed: ${upstream.status}`,
    };
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  return {
    statusCode: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
    },
    body: bytes.toString("base64"),
    isBase64Encoded: true,
  };
};
