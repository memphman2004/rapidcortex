import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { GuestAssistTokenPayload } from "./schemas.js";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function signGuestAssistToken(payload: GuestAssistTokenPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyGuestAssistToken(token: string, secret: string): GuestAssistTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = b64url(createHmac("sha256", secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GuestAssistTokenPayload;
    if (!payload.sid || !payload.v || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newGuestAssistSessionId(): string {
  return randomUUID();
}
