import type { DemoTokenClaims, DemoTokenFailure } from "../types";

export class DemoTokenConfigError extends Error {
  constructor() {
    super("Demo token signing secret is not configured");
    this.name = "DemoTokenConfigError";
  }
}

export interface DemoTokenVerdict {
  ok: true;
  claims: DemoTokenClaims;
}

export interface DemoTokenRejection {
  ok: false;
  reason: DemoTokenFailure;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function canonicalPayload(claims: DemoTokenClaims): string {
  return JSON.stringify({
    v: 1,
    scenarioId: claims.scenarioId,
    offsetSeconds: claims.offsetSeconds,
    tourStop: claims.tourStop,
    exp: claims.exp,
    iss: claims.iss,
    jti: claims.jti,
  });
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export function createDemoTokenClaims(input: {
  scenarioId: string;
  issuer: string;
  offsetSeconds?: number;
  tourStop?: string;
  expiresInSeconds?: number;
  now?: number;
  jti?: string;
}): DemoTokenClaims {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  return {
    v: 1,
    scenarioId: input.scenarioId,
    offsetSeconds: input.offsetSeconds ?? 0,
    tourStop: input.tourStop ?? "",
    exp: now + (input.expiresInSeconds ?? 7 * 24 * 60 * 60),
    iss: input.issuer,
    jti: input.jti ?? crypto.randomUUID(),
  };
}

export async function signDemoToken(claims: DemoTokenClaims, secret: string): Promise<string> {
  if (!secret.trim()) throw new DemoTokenConfigError();
  const encoded = encodeBase64Url(new TextEncoder().encode(canonicalPayload(claims)));
  const signature = encodeBase64Url(await hmac(secret, encoded));
  return `${encoded}.${signature}`;
}

export async function verifyDemoToken(
  token: string,
  secret: string,
  options?: {
    now?: number;
    isRevoked?: (claims: DemoTokenClaims) => boolean;
  },
): Promise<DemoTokenVerdict | DemoTokenRejection> {
  if (!secret.trim()) return { ok: false, reason: "unconfigured" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "invalid" };
  const [encoded, presented] = parts;
  if (!encoded || !presented) return { ok: false, reason: "invalid" };

  const expected = encodeBase64Url(await hmac(secret, encoded));
  const presentedBytes = new TextEncoder().encode(presented);
  const expectedBytes = new TextEncoder().encode(expected);
  if (!timingSafeEqual(presentedBytes, expectedBytes)) return { ok: false, reason: "invalid" };

  let claims: DemoTokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as DemoTokenClaims;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (claims.v !== 1 || !claims.scenarioId || !claims.jti || !claims.iss || typeof claims.exp !== "number") {
    return { ok: false, reason: "invalid" };
  }
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return { ok: false, reason: "expired" };
  if (options?.isRevoked?.(claims)) return { ok: false, reason: "revoked" };
  return { ok: true, claims };
}
