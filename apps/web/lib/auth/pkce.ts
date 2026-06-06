import { createHash, randomBytes } from "node:crypto";

export function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(64));
}

export function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier, "utf8").digest());
}

export function generateState(): string {
  return base64UrlEncode(randomBytes(32));
}
