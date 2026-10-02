import { createHmac } from "node:crypto";

/** Must match `apps/video-gateway/gateway-auth.ts`. */
export function signVideoGatewayBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
