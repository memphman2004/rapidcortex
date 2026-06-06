import { NextResponse } from "next/server";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function configuredAllowedOrigins(): Set<string> {
  const configured = (process.env.APP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
  if (isDevelopment()) {
    configured.push("http://localhost:3000", "http://127.0.0.1:3000");
  }
  return new Set(configured);
}

function originFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return normalizeOrigin(new URL(referer).origin);
  } catch {
    return null;
  }
}

export function enforceTrustedOrigin(request: Request): NextResponse | null {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) return null;

  const allowed = configuredAllowedOrigins();
  if (allowed.size === 0) {
    return NextResponse.json({ error: "Origin validation is not configured." }, { status: 403 });
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const candidateOrigin = originHeader
    ? normalizeOrigin(originHeader)
    : originFromReferer(refererHeader);
  if (!candidateOrigin || !allowed.has(candidateOrigin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}
