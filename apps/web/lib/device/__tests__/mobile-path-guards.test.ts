import { describe, expect, it } from "vitest";
import {
  isMobilePublicApiPath,
  pathnameIsMobileOperationalBlockedPage,
} from "../operations-mobile-blocklist";

describe("pathnameIsMobileOperationalBlockedPage", () => {
  it("allows public marketing homepage", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/")).toBe(false);
  });

  it("allows /pricing segment", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/pricing")).toBe(false);
  });

  it("allows /book-demo (redirect target)", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/book-demo")).toBe(false);
  });

  it("allows mobile restriction page itself", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/mobile-access-restricted")).toBe(false);
  });

  it("blocks /login", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/login")).toBe(true);
  });

  it("blocks /auth/native-login", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/auth/native-login")).toBe(true);
  });

  it("blocks jurisdiction login", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/columbus-oh/login")).toBe(true);
  });

  it("blocks /dashboard leaf under jurisdiction", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/columbus-oh/dashboard")).toBe(true);
  });

  it("does not falsely block jurisdictions named like unrelated products", () => {
    expect(pathnameIsMobileOperationalBlockedPage("/docs")).toBe(true);
    expect(pathnameIsMobileOperationalBlockedPage("/pricing")).toBe(false);
  });
});

describe("isMobilePublicApiPath", () => {
  it("allows api health subtree", () => {
    expect(isMobilePublicApiPath("/api/health/web")).toBe(true);
  });

  it("allows contact-sales", () => {
    expect(isMobilePublicApiPath("/api/contact-sales")).toBe(true);
  });

  it("does not classify operational BFF as public", () => {
    expect(isMobilePublicApiPath("/api/backend/foo")).toBe(false);
    expect(isMobilePublicApiPath("/api/auth/session")).toBe(false);
  });
});
