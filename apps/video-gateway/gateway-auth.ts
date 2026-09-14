import { createHmac, timingSafeEqual } from "node:crypto";

/** Must match `apps/api/src/services/videoGatewayHmac.ts`. */
export function signVideoGatewayBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function gatewayAuthValid(secret: string, body: string, header: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = signVideoGatewayBody(secret, body);
  const got = header.trim().toLowerCase();
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
}
