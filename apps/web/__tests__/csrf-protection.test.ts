import { afterEach, describe, expect, it } from "vitest";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, validateCsrfForRequest } from "../lib/csrf";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

function makeRequest(options: {
  method: string;
  origin?: string;
  referer?: string;
  cookieToken?: string;
  headerToken?: string;
}) {
  const headers = new Headers();
  if (options.origin) headers.set("origin", options.origin);
  if (options.referer) headers.set("referer", options.referer);
  if (options.cookieToken) headers.set("cookie", `${CSRF_COOKIE_NAME}=${options.cookieToken}`);
  if (options.headerToken) headers.set(CSRF_HEADER_NAME, options.headerToken);
  return new Request("https://www.rapidcortex.us/api/auth/signin", {
    method: options.method,
    headers,
  });
}

describe("CSRF double-submit protection", () => {
  it("allows origin from NEXT_PUBLIC_SITE_URL when APP_ALLOWED_ORIGINS is unset", () => {
    delete process.env.APP_ALLOWED_ORIGINS;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com/";
    const req = makeRequest({
      method: "POST",
      origin: "https://app.example.com",
      cookieToken: "abc123token",
      headerToken: "abc123token",
    });
    expect(validateCsrfForRequest(req)).toEqual({ ok: true });
  });

  it("allows valid same-origin state-changing request with matching token", () => {
    process.env.APP_ALLOWED_ORIGINS = "https://www.rapidcortex.us,https://rapidcortex.us";
    const req = makeRequest({
      method: "POST",
      origin: "https://www.rapidcortex.us",
      cookieToken: "abc123token",
      headerToken: "abc123token",
    });
    expect(validateCsrfForRequest(req)).toEqual({ ok: true });
  });

  it("fails cross-origin state-changing request", () => {
    process.env.APP_ALLOWED_ORIGINS = "https://www.rapidcortex.us";
    const req = makeRequest({
      method: "POST",
      origin: "https://evil.example.com",
      cookieToken: "abc123token",
      headerToken: "abc123token",
    });
    expect(validateCsrfForRequest(req)).toEqual({
      ok: false,
      message: "CSRF validation failed: origin is not allowed.",
    });
  });

  it("fails missing origin on state-changing request", () => {
    process.env.APP_ALLOWED_ORIGINS = "https://www.rapidcortex.us";
    const req = makeRequest({
      method: "POST",
      cookieToken: "abc123token",
      headerToken: "abc123token",
    });
    expect(validateCsrfForRequest(req)).toEqual({
      ok: false,
      message: "CSRF validation failed: missing Origin header.",
    });
  });

  it("fails invalid csrf token", () => {
    process.env.APP_ALLOWED_ORIGINS = "https://www.rapidcortex.us";
    const req = makeRequest({
      method: "POST",
      origin: "https://www.rapidcortex.us",
      cookieToken: "token-a",
      headerToken: "token-b",
    });
    expect(validateCsrfForRequest(req)).toEqual({
      ok: false,
      message: "CSRF validation failed: invalid CSRF token.",
    });
  });

  it("exempts GET/HEAD/OPTIONS", () => {
    process.env.APP_ALLOWED_ORIGINS = "https://www.rapidcortex.us";
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const req = makeRequest({ method });
      expect(validateCsrfForRequest(req)).toEqual({ ok: true });
    }
  });

  it("allows any loopback origin in development (alternate ports / default port)", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    process.env.APP_ALLOWED_ORIGINS = "https://www.rapidcortex.us";
    try {
      for (const origin of [
        "http://localhost:3001",
        "http://127.0.0.1:3099",
        "http://localhost",
      ]) {
        const req = makeRequest({
          method: "POST",
          origin,
          cookieToken: "abc123token",
          headerToken: "abc123token",
        });
        expect(validateCsrfForRequest(req)).toEqual({ ok: true });
      }
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
