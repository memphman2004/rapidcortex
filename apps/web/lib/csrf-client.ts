"use client";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf-constants";

function readCsrfCookieValue(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CSRF_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

/** Ensures `rc_csrf_token` exists (GET `/api/auth/session` seeds it via middleware). */
export async function ensureCsrfCookie(): Promise<void> {
  if (readCsrfCookieValue()) return;
  await fetch("/api/auth/session", { credentials: "include" });
}

/** Adds `X-CSRF-Token` when the cookie is readable (non-httpOnly). */
export function csrfHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = readCsrfCookieValue();
  if (token) headers.set(CSRF_HEADER_NAME, token);
  return headers;
}

export function jsonHeadersWithCsrf(): Headers {
  return csrfHeaders({ "Content-Type": "application/json" });
}
