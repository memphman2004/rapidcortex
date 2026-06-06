import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { expandCanonicalHttpOrigins, isLocalDevelopmentOrigin, normalizeHttpOrigin } from "@/lib/http-origin-allowlist";
import { getSiteUrl } from "@/lib/seo";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf-constants";

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };

function randomHexUtf8(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type CsrfValidationResult = { ok: true } | { ok: false; message: string };

function originFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return normalizeHttpOrigin(new URL(referer).origin);
  } catch {
    return null;
  }
}

function parseCookieValue(rawCookieHeader: string | null, name: string): string | null {
  if (!rawCookieHeader) return null;
  const pairs = rawCookieHeader.split(";");
  for (const pair of pairs) {
    const [k, ...rest] = pair.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function allowedOrigins(): Set<string> {
  const configured: string[] = [];
  for (const raw of (process.env.APP_ALLOWED_ORIGINS ?? "").split(",")) {
    const piece = raw.trim();
    if (!piece) continue;
    try {
      const u = new URL(piece.includes("://") ? piece : `https://${piece}`);
      configured.push(...expandCanonicalHttpOrigins(u.origin));
    } catch {
      configured.push(normalizeHttpOrigin(piece));
    }
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      const origin = new URL(siteUrl).origin;
      configured.push(...expandCanonicalHttpOrigins(origin));
    } catch {
      // ignore invalid URL
    }
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    try {
      const origin = new URL(`https://${vercelUrl}`).origin;
      configured.push(...expandCanonicalHttpOrigins(origin));
    } catch {
      // ignore invalid URL
    }
  }
  if (configured.length === 0) {
    try {
      configured.push(...expandCanonicalHttpOrigins(new URL(getSiteUrl()).origin));
    } catch {
      // keep empty — validateCsrfForRequest will reject state-changing requests
    }
  }
  if (process.env.NODE_ENV !== "production") {
    configured.push("http://localhost:3000", "http://127.0.0.1:3000");
    configured.push("http://localhost:3001", "http://127.0.0.1:3001");
  }
  return new Set(configured.map(normalizeHttpOrigin));
}

function originIsAllowed(candidateOrigin: string, allowed: Set<string>): boolean {
  if (allowed.has(candidateOrigin)) return true;
  return process.env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(candidateOrigin);
}

export function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
}

export function generateCsrfToken(): string {
  return randomHexUtf8(32);
}

/**
 * Double-submit cookie validation:
 * 1) Request must come from an allowed same-origin Origin/Referer.
 * 2) `X-CSRF-Token` header must exactly match cookie `rc_csrf_token`.
 */
export function validateCsrfForRequest(request: Request): CsrfValidationResult {
  if (!isStateChangingMethod(request.method)) return { ok: true };

  const allowed = allowedOrigins();
  if (allowed.size === 0) {
    return { ok: false, message: "CSRF validation failed: origin allowlist is not configured." };
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const candidateOrigin = originHeader
    ? normalizeHttpOrigin(originHeader)
    : originFromReferer(refererHeader);
  if (!candidateOrigin) {
    return { ok: false, message: "CSRF validation failed: missing Origin header." };
  }
  if (!originIsAllowed(candidateOrigin, allowed)) {
    return { ok: false, message: "CSRF validation failed: origin is not allowed." };
  }

  const cookieToken = parseCookieValue(request.headers.get("cookie"), CSRF_COOKIE_NAME);
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken) {
    return { ok: false, message: "CSRF validation failed: missing CSRF token." };
  }
  if (cookieToken !== headerToken) {
    return { ok: false, message: "CSRF validation failed: invalid CSRF token." };
  }
  return { ok: true };
}

export function enforceCsrfProtection(request: Request): NextResponse | null {
  const result = validateCsrfForRequest(request);
  if (result.ok) return null;
  return NextResponse.json({ error: result.message }, { status: 403 });
}

function attachCsrfCookie(
  response: NextResponse,
  existingToken?: string | null,
): NextResponse {
  const token = existingToken?.trim() || generateCsrfToken();
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

export function withCsrfCookie(response: NextResponse, request: Request): NextResponse {
  const existing = parseCookieValue(request.headers.get("cookie"), CSRF_COOKIE_NAME);
  return attachCsrfCookie(response, existing);
}

const nativeTokenExchangePaths = new Set(["/api/auth/native/token"]);

export function ensureCsrfOnAuthApiRequest(request: NextRequest): NextResponse {
  const method = request.method.toUpperCase();
  if (!request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();

  /** Desktop/mobile apps call token exchange with JSON bodies (no browser CSRF cookie). */
  if (nativeTokenExchangePaths.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!isStateChangingMethod(method)) {
    // Seed token for browser clients so subsequent write calls can echo it in header.
    const res = NextResponse.next();
    return attachCsrfCookie(res, request.cookies.get(CSRF_COOKIE_NAME)?.value);
  }

  const result = validateCsrfForRequest(request);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 403 });
  }
  return NextResponse.next();
}
